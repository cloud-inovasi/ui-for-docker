package docker

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"path"

	"github.com/docker/docker/client"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/http/proxy/factory/utils"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/authorization"
	"github.com/portainer/portainer/api/internal/snapshot"
)

const (
	volumeObjectIdentifier = "ResourceID"
)

func getInheritedResourceControlFromVolumeLabels(dockerClient *client.Client, endpointID portainer.EndpointID, volumeID string, resourceControls []portainer.ResourceControl) (*portainer.ResourceControl, error) {
	volume, err := dockerClient.VolumeInspect(context.Background(), volumeID)
	if err != nil {
		return nil, err
	}

	stackResourceID := getStackResourceIDFromLabels(volume.Labels, endpointID)
	if stackResourceID != "" {
		return authorization.GetResourceControlByResourceIDAndType(stackResourceID, portainer.StackResourceControl, resourceControls), nil
	}

	return nil, nil
}

// volumeListOperation extracts the response as a JSON object, loop through the volume array
// decorate and/or filter the volumes based on resource controls before rewriting the response.
func (transport *Transport) volumeListOperation(response *http.Response, executor *operationExecutor) error {
	// VolumeList response is a JSON object
	// https://docs.docker.com/engine/api/v1.28/#operation/VolumeList
	responseObject, err := utils.GetResponseAsJSONObject(response)
	if err != nil {
		return err
	}

	// The "Volumes" field contains the list of volumes as an array of JSON objects
	if responseObject["Volumes"] != nil {
		volumeData := responseObject["Volumes"].([]interface{})

		for _, volumeObject := range volumeData {
			volume := volumeObject.(map[string]interface{})

			err = transport.decorateVolumeResponseWithResourceID(volume)
			if err != nil {
				return fmt.Errorf("failed decorating volume response: %w", err)
			}

		}

		resourceOperationParameters := &resourceOperationParameters{
			resourceIdentifierAttribute: volumeObjectIdentifier,
			resourceType:                portainer.VolumeResourceControl,
			labelsObjectSelector:        selectorVolumeLabels,
		}

		volumeData, err = transport.applyAccessControlOnResourceList(resourceOperationParameters, volumeData, executor)
		if err != nil {
			return err
		}
		// Overwrite the original volume list
		responseObject["Volumes"] = volumeData
	}

	return utils.RewriteResponse(response, responseObject, http.StatusOK)
}

// volumeInspectOperation extracts the response as a JSON object, verify that the user
// has access to the volume based on any existing resource control and either rewrite an access denied response or a decorated volume.
func (transport *Transport) volumeInspectOperation(response *http.Response, executor *operationExecutor) error {
	// VolumeInspect response is a JSON object
	// https://docs.docker.com/engine/api/v1.28/#operation/VolumeInspect
	responseObject, err := utils.GetResponseAsJSONObject(response)
	if err != nil {
		return err
	}

	err = transport.decorateVolumeResponseWithResourceID(responseObject)
	if err != nil {
		return fmt.Errorf("failed decorating volume response: %w", err)
	}

	resourceOperationParameters := &resourceOperationParameters{
		resourceIdentifierAttribute: volumeObjectIdentifier,
		resourceType:                portainer.VolumeResourceControl,
		labelsObjectSelector:        selectorVolumeLabels,
	}

	return transport.applyAccessControlOnResource(resourceOperationParameters, responseObject, response, executor)
}

func (transport *Transport) decorateVolumeResponseWithResourceID(responseObject map[string]interface{}) error {
	if responseObject["Name"] == nil {
		return errors.New("missing identifier in Docker resource detail response")
	}

	resourceID, err := transport.getVolumeResourceID(responseObject["Name"].(string))
	if err != nil {
		return fmt.Errorf("failed fetching resource id: %w", err)
	}

	responseObject[volumeObjectIdentifier] = resourceID

	return nil
}

// selectorVolumeLabels retrieve the labels object associated to the volume object.
// Labels are available under the "Labels" property.
// API schema references:
// https://docs.docker.com/engine/api/v1.28/#operation/VolumeInspect
// https://docs.docker.com/engine/api/v1.28/#operation/VolumeList
func selectorVolumeLabels(responseObject map[string]interface{}) map[string]interface{} {
	return utils.GetJSONObject(responseObject, "Labels")
}

func (transport *Transport) decorateVolumeResourceCreationOperation(request *http.Request, resourceType portainer.ResourceControlType) (*http.Response, error) {
	tokenData, err := security.RetrieveTokenData(request)
	if err != nil {
		return nil, err
	}

	volumeID := request.Header.Get("X-Portainer-VolumeName")

	if volumeID != "" {
		cli := transport.dockerClient
		agentTargetHeader := request.Header.Get(portainer.PortainerAgentTargetHeader)
		if agentTargetHeader != "" {
			dockerClient, err := transport.dockerClientFactory.CreateClient(transport.endpoint, agentTargetHeader)
			if err != nil {
				return nil, err
			}
			defer dockerClient.Close()
			cli = dockerClient
		}

		_, err = cli.VolumeInspect(context.Background(), volumeID)
		if err == nil {
			return nil, errors.New("a volume with the same name already exists")
		}
	}

	response, err := transport.executeDockerRequest(request)
	if err != nil {
		return response, err
	}

	if response.StatusCode == http.StatusCreated {
		err = transport.decorateVolumeCreationResponse(response, resourceType, tokenData.ID)
	}
	return response, err
}

func (transport *Transport) decorateVolumeCreationResponse(response *http.Response, resourceType portainer.ResourceControlType, userID portainer.UserID) error {
	responseObject, err := utils.GetResponseAsJSONObject(response)
	if err != nil {
		return err
	}

	if responseObject["Name"] == nil {
		return errors.New("missing identifier in Docker resource creation response")
	}

	resourceID, err := transport.getVolumeResourceID(responseObject["Name"].(string))
	if err != nil {
		return fmt.Errorf("failed fetching resource id: %w", err)
	}

	resourceControl, err := transport.createPrivateResourceControl(resourceID, resourceType, userID)
	if err != nil {
		return err
	}

	responseObject[volumeObjectIdentifier] = resourceID

	responseObject = decorateObject(responseObject, resourceControl)

	return utils.RewriteResponse(response, responseObject, http.StatusOK)
}

func (transport *Transport) restrictedVolumeOperation(requestPath string, request *http.Request) (*http.Response, error) {

	if request.Method == http.MethodGet {
		return transport.rewriteOperation(request, transport.volumeInspectOperation)
	}

	volumeName := path.Base(requestPath)

	resourceID, err := transport.getVolumeResourceID(volumeName)
	if err != nil {
		return nil, err
	}

	if request.Method == http.MethodDelete {
		return transport.executeGenericResourceDeletionOperation(request, resourceID, volumeName, portainer.VolumeResourceControl)
	}
	return transport.restrictedResourceOperation(request, resourceID, volumeName, portainer.VolumeResourceControl, false)
}

func (transport *Transport) getVolumeResourceID(volumeName string) (string, error) {
	dockerID, err := transport.getDockerID()
	if err != nil {
		return "", fmt.Errorf("failed fetching docker id: %w", err)
	}
	return fmt.Sprintf("%s_%s", volumeName, dockerID), nil
}

func (transport *Transport) getDockerID() (string, error) {
	if len(transport.endpoint.Snapshots) > 0 {
		dockerID, err := snapshot.FetchDockerID(transport.endpoint.Snapshots[0])
		// ignore err - in case of error, just generate not from snapshot
		if err == nil {
			return dockerID, nil
		}
	}

	cli := transport.dockerClient
	defer cli.Close()

	info, err := cli.Info(context.Background())
	if err != nil {
		return "", err
	}

	if info.Swarm.Cluster != nil {
		return info.Swarm.Cluster.ID, nil
	}

	return info.ID, nil
}
