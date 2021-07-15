package snapshot

import (
	"context"
	"errors"
	"log"
	"time"

	portainer "github.com/portainer/portainer/api"
)

// Service repesents a service to manage endpoint snapshots.
// It provides an interface to start background snapshots as well as
// specific Docker/Kubernetes endpoint snapshot methods.
type Service struct {
	dataStore                 portainer.DataStore
	refreshSignal             chan struct{}
	snapshotIntervalInSeconds float64
	dockerSnapshotter         portainer.DockerSnapshotter
	kubernetesSnapshotter     portainer.KubernetesSnapshotter
	shutdownCtx               context.Context
}

// NewService creates a new instance of a service
func NewService(snapshotInterval string, dataStore portainer.DataStore, dockerSnapshotter portainer.DockerSnapshotter, kubernetesSnapshotter portainer.KubernetesSnapshotter, shutdownCtx context.Context) (*Service, error) {
	snapshotFrequency, err := time.ParseDuration(snapshotInterval)
	if err != nil {
		return nil, err
	}

	return &Service{
		dataStore:                 dataStore,
		snapshotIntervalInSeconds: snapshotFrequency.Seconds(),
		dockerSnapshotter:         dockerSnapshotter,
		kubernetesSnapshotter:     kubernetesSnapshotter,
		shutdownCtx:               shutdownCtx,
	}, nil
}

// Start will start a background routine to execute periodic snapshots of endpoints
func (service *Service) Start() {
	if service.refreshSignal != nil {
		return
	}

	service.refreshSignal = make(chan struct{})
	service.startSnapshotLoop()
}

func (service *Service) Stop() {
	if service.refreshSignal == nil {
		return
	}

	// clear refreshSignal to mark the service as disabled
	close(service.refreshSignal)
	service.refreshSignal = nil
}

// SetSnapshotInterval sets the snapshot interval and resets the service
func (service *Service) SetSnapshotInterval(snapshotInterval string) error {
	service.Stop()

	snapshotFrequency, err := time.ParseDuration(snapshotInterval)
	if err != nil {
		return err
	}
	service.snapshotIntervalInSeconds = snapshotFrequency.Seconds()

	service.Start()

	return nil
}

// SupportDirectSnapshot checks whether an endpoint can be used to trigger a direct a snapshot.
// It is mostly true for all endpoints except Edge and Azure endpoints.
func SupportDirectSnapshot(endpoint *portainer.Endpoint) bool {
	switch endpoint.Type {
	case portainer.EdgeAgentOnDockerEnvironment, portainer.EdgeAgentOnKubernetesEnvironment, portainer.AzureEnvironment:
		return false
	}
	return true
}

// SnapshotEndpoint will create a snapshot of the endpoint based on the endpoint type.
// If the snapshot is a success, it will be associated to the endpoint.
func (service *Service) SnapshotEndpoint(endpoint *portainer.Endpoint) error {
	switch endpoint.Type {
	case portainer.AzureEnvironment:
		return nil
	case portainer.KubernetesLocalEnvironment, portainer.AgentOnKubernetesEnvironment, portainer.EdgeAgentOnKubernetesEnvironment:
		return service.snapshotKubernetesEndpoint(endpoint)
	}

	return service.snapshotDockerEndpoint(endpoint)
}

func (service *Service) snapshotKubernetesEndpoint(endpoint *portainer.Endpoint) error {
	snapshot, err := service.kubernetesSnapshotter.CreateSnapshot(endpoint)
	if err != nil {
		return err
	}

	if snapshot != nil {
		endpoint.Kubernetes.Snapshots = []portainer.KubernetesSnapshot{*snapshot}
	}

	return nil
}

func (service *Service) snapshotDockerEndpoint(endpoint *portainer.Endpoint) error {
	snapshot, err := service.dockerSnapshotter.CreateSnapshot(endpoint)
	if err != nil {
		return err
	}

	if snapshot != nil {
		endpoint.Snapshots = []portainer.DockerSnapshot{*snapshot}
	}

	return nil
}

func (service *Service) startSnapshotLoop() error {
	ticker := time.NewTicker(time.Duration(service.snapshotIntervalInSeconds) * time.Second)
	go func() {
		err := service.snapshotEndpoints()
		if err != nil {
			log.Printf("[ERROR] [internal,snapshot] [message: background schedule error (endpoint snapshot).] [error: %s]", err)
		}

		for {
			select {
			case <-ticker.C:
				err := service.snapshotEndpoints()
				if err != nil {
					log.Printf("[ERROR] [internal,snapshot] [message: background schedule error (endpoint snapshot).] [error: %s]", err)
				}
			case <-service.shutdownCtx.Done():
				log.Println("[DEBUG] [internal,snapshot] [message: shutting down snapshotting]")
				ticker.Stop()
				return
			case <-service.refreshSignal:
				log.Println("[DEBUG] [internal,snapshot] [message: shutting down snapshotting]")
				ticker.Stop()
				return
			}
		}
	}()

	return nil
}

func (service *Service) snapshotEndpoints() error {
	endpoints, err := service.dataStore.Endpoint().Endpoints()
	if err != nil {
		return err
	}

	for _, endpoint := range endpoints {
		if !SupportDirectSnapshot(&endpoint) {
			continue
		}

		snapshotError := service.SnapshotEndpoint(&endpoint)

		latestEndpointReference, err := service.dataStore.Endpoint().Endpoint(endpoint.ID)
		if latestEndpointReference == nil {
			log.Printf("background schedule error (endpoint snapshot). Endpoint not found inside the database anymore (endpoint=%s, URL=%s) (err=%s)\n", endpoint.Name, endpoint.URL, err)
			continue
		}

		latestEndpointReference.Status = portainer.EndpointStatusUp
		if snapshotError != nil {
			log.Printf("background schedule error (endpoint snapshot). Unable to create snapshot (endpoint=%s, URL=%s) (err=%s)\n", endpoint.Name, endpoint.URL, snapshotError)
			latestEndpointReference.Status = portainer.EndpointStatusDown
		}

		latestEndpointReference.Snapshots = endpoint.Snapshots
		latestEndpointReference.Kubernetes.Snapshots = endpoint.Kubernetes.Snapshots

		err = service.dataStore.Endpoint().UpdateEndpoint(latestEndpointReference.ID, latestEndpointReference)
		if err != nil {
			log.Printf("background schedule error (endpoint snapshot). Unable to update endpoint (endpoint=%s, URL=%s) (err=%s)\n", endpoint.Name, endpoint.URL, err)
			continue
		}
	}

	return nil
}

// FetchDockerID fetches info.Swarm.Cluster.ID if endpoint is swarm and info.ID otherwise
func FetchDockerID(snapshot portainer.DockerSnapshot) (string, error) {
	info, done := snapshot.SnapshotRaw.Info.(map[string]interface{})
	if !done {
		return "", errors.New("failed getting snapshot info")
	}

	if !snapshot.Swarm {
		return info["ID"].(string), nil
	}

	if info["Swarm"] == nil {
		return "", errors.New("swarm endpoint is missing swarm info snapshot")
	}

	swarmInfo := info["Swarm"].(map[string]interface{})
	if swarmInfo["Cluster"] == nil {
		return "", errors.New("swarm endpoint is missing cluster info snapshot")
	}

	clusterInfo := swarmInfo["Cluster"].(map[string]interface{})
	return clusterInfo["ID"].(string), nil
}
