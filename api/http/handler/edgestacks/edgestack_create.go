package edgestacks

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/asaskevich/govalidator"
	httperror "github.com/portainer/libhttp/error"
	"github.com/portainer/libhttp/request"
	"github.com/portainer/libhttp/response"
	"github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/filesystem"
)

// POST request on /api/endpoint_groups
func (handler *Handler) edgeStackCreate(w http.ResponseWriter, r *http.Request) *httperror.HandlerError {
	method, err := request.RetrieveQueryParameter(r, "method", false)
	if err != nil {
		return &httperror.HandlerError{http.StatusBadRequest, "Invalid query parameter: method", err}
	}

	switch method {
	case "string":
		return handler.createSwarmStackFromFileContent(w, r)
	case "repository":
		return handler.createSwarmStackFromGitRepository(w, r)
	case "file":
		return handler.createSwarmStackFromFileUpload(w, r)
	}

	return &httperror.HandlerError{http.StatusBadRequest, "Invalid value for query parameter: method. Value must be one of: string, repository or file", errors.New(request.ErrInvalidQueryParameter)}
}

type swarmStackFromFileContentPayload struct {
	Name             string
	StackFileContent string
	EdgeGroups       []portainer.EdgeGroupID
}

func (payload *swarmStackFromFileContentPayload) Validate(r *http.Request) error {
	if govalidator.IsNull(payload.Name) {
		return portainer.Error("Invalid stack name")
	}
	if govalidator.IsNull(payload.StackFileContent) {
		return portainer.Error("Invalid stack file content")
	}
	if payload.EdgeGroups == nil || len(payload.EdgeGroups) == 0 {
		return portainer.Error("Edge Groups are mandatory for an Edge stack")
	}
	return nil
}

func (handler *Handler) createSwarmStackFromFileContent(w http.ResponseWriter, r *http.Request) *httperror.HandlerError {
	var payload swarmStackFromFileContentPayload
	err := request.DecodeAndValidateJSONPayload(r, &payload)
	if err != nil {
		return &httperror.HandlerError{http.StatusBadRequest, "Invalid request payload", err}
	}

	err = handler.validateUniqueName(payload.Name)
	if err != nil {
		return &httperror.HandlerError{http.StatusBadRequest, "Invalid request payload", err}
	}

	stackID := handler.EdgeStackService.GetNextIdentifier()
	stack := &portainer.EdgeStack{
		ID:           portainer.EdgeStackID(stackID),
		Name:         payload.Name,
		EntryPoint:   filesystem.ComposeFileDefaultName,
		CreationDate: time.Now().Unix(),
		EdgeGroups:   payload.EdgeGroups,
		Status:       make(map[portainer.EndpointID]portainer.EdgeStackStatus),
		Version:      1,
	}

	stackFolder := strconv.Itoa(int(stack.ID))
	projectPath, err := handler.FileService.StoreEdgeStackFileFromBytes(stackFolder, stack.EntryPoint, []byte(payload.StackFileContent))
	if err != nil {
		return &httperror.HandlerError{http.StatusInternalServerError, "Unable to persist Stack file on disk", err}
	}
	stack.ProjectPath = projectPath

	err = handler.EdgeStackService.CreateEdgeStack(stack)
	if err != nil {
		return &httperror.HandlerError{http.StatusInternalServerError, "Unable to persist the edge stack inside the database", err}
	}

	return response.JSON(w, stack)
}

type swarmStackFromGitRepositoryPayload struct {
	Name                        string
	RepositoryURL               string
	RepositoryReferenceName     string
	RepositoryAuthentication    bool
	RepositoryUsername          string
	RepositoryPassword          string
	ComposeFilePathInRepository string
	EdgeGroups                  []portainer.EdgeGroupID
}

func (payload *swarmStackFromGitRepositoryPayload) Validate(r *http.Request) error {
	if govalidator.IsNull(payload.Name) {
		return portainer.Error("Invalid stack name")
	}
	if govalidator.IsNull(payload.RepositoryURL) || !govalidator.IsURL(payload.RepositoryURL) {
		return portainer.Error("Invalid repository URL. Must correspond to a valid URL format")
	}
	if payload.RepositoryAuthentication && (govalidator.IsNull(payload.RepositoryUsername) || govalidator.IsNull(payload.RepositoryPassword)) {
		return portainer.Error("Invalid repository credentials. Username and password must be specified when authentication is enabled")
	}
	if govalidator.IsNull(payload.ComposeFilePathInRepository) {
		payload.ComposeFilePathInRepository = filesystem.ComposeFileDefaultName
	}
	if payload.EdgeGroups == nil || len(payload.EdgeGroups) == 0 {
		return portainer.Error("Edge Groups are mandatory for an Edge stack")
	}
	return nil
}

func (handler *Handler) createSwarmStackFromGitRepository(w http.ResponseWriter, r *http.Request) *httperror.HandlerError {
	var payload swarmStackFromGitRepositoryPayload
	err := request.DecodeAndValidateJSONPayload(r, &payload)
	if err != nil {
		return &httperror.HandlerError{http.StatusBadRequest, "Invalid request payload", err}
	}

	err = handler.validateUniqueName(payload.Name)
	if err != nil {
		return &httperror.HandlerError{http.StatusBadRequest, "Invalid request payload", err}
	}

	stackID := handler.EdgeStackService.GetNextIdentifier()
	stack := &portainer.EdgeStack{
		ID:           portainer.EdgeStackID(stackID),
		Name:         payload.Name,
		EntryPoint:   payload.ComposeFilePathInRepository,
		CreationDate: time.Now().Unix(),
		EdgeGroups:   payload.EdgeGroups,
		Status:       make(map[portainer.EndpointID]portainer.EdgeStackStatus),
		Version:      1,
	}

	projectPath := handler.FileService.GetEdgeStackProjectPath(strconv.Itoa(int(stack.ID)))
	stack.ProjectPath = projectPath

	gitCloneParams := &cloneRepositoryParameters{
		url:            payload.RepositoryURL,
		referenceName:  payload.RepositoryReferenceName,
		path:           projectPath,
		authentication: payload.RepositoryAuthentication,
		username:       payload.RepositoryUsername,
		password:       payload.RepositoryPassword,
	}

	err = handler.cloneGitRepository(gitCloneParams)
	if err != nil {
		return &httperror.HandlerError{http.StatusInternalServerError, "Unable to clone git repository", err}
	}

	err = handler.EdgeStackService.CreateEdgeStack(stack)
	if err != nil {
		return &httperror.HandlerError{http.StatusInternalServerError, "Unable to persist the stack inside the database", err}
	}

	return response.JSON(w, stack)
}

type swarmStackFromFileUploadPayload struct {
	Name             string
	StackFileContent []byte
	EdgeGroups       []portainer.EdgeGroupID
}

func (payload *swarmStackFromFileUploadPayload) Validate(r *http.Request) error {
	name, err := request.RetrieveMultiPartFormValue(r, "Name", false)
	if err != nil {
		return portainer.Error("Invalid stack name")
	}
	payload.Name = name

	composeFileContent, _, err := request.RetrieveMultiPartFormFile(r, "file")
	if err != nil {
		return portainer.Error("Invalid Compose file. Ensure that the Compose file is uploaded correctly")
	}
	payload.StackFileContent = composeFileContent

	var edgeGroups []portainer.EdgeGroupID
	err = request.RetrieveMultiPartFormJSONValue(r, "EdgeGroups", &edgeGroups, false)
	if err != nil || len(edgeGroups) == 0 {
		return portainer.Error("Edge Groups are mandatory for an Edge stack")
	}
	payload.EdgeGroups = edgeGroups
	return nil
}

func (handler *Handler) createSwarmStackFromFileUpload(w http.ResponseWriter, r *http.Request) *httperror.HandlerError {
	payload := &swarmStackFromFileUploadPayload{}
	err := payload.Validate(r)
	if err != nil {
		return &httperror.HandlerError{http.StatusBadRequest, "Invalid request payload", err}
	}

	err = handler.validateUniqueName(payload.Name)
	if err != nil {
		return &httperror.HandlerError{http.StatusBadRequest, "Invalid request payload", err}
	}

	stackID := handler.EdgeStackService.GetNextIdentifier()
	stack := &portainer.EdgeStack{
		ID:           portainer.EdgeStackID(stackID),
		Name:         payload.Name,
		EntryPoint:   filesystem.ComposeFileDefaultName,
		CreationDate: time.Now().Unix(),
		EdgeGroups:   payload.EdgeGroups,
		Status:       make(map[portainer.EndpointID]portainer.EdgeStackStatus),
		Version:      1,
	}

	stackFolder := strconv.Itoa(int(stack.ID))
	projectPath, err := handler.FileService.StoreEdgeStackFileFromBytes(stackFolder, stack.EntryPoint, []byte(payload.StackFileContent))
	if err != nil {
		return &httperror.HandlerError{http.StatusInternalServerError, "Unable to persist Stack file on disk", err}
	}
	stack.ProjectPath = projectPath

	err = handler.EdgeStackService.CreateEdgeStack(stack)
	if err != nil {
		return &httperror.HandlerError{http.StatusInternalServerError, "Unable to persist the stack inside the database", err}
	}

	return response.JSON(w, stack)
}

func (handler *Handler) validateUniqueName(name string) error {
	edgeStacks, err := handler.EdgeStackService.EdgeStacks()
	if err != nil {
		return err
	}

	for _, stack := range edgeStacks {
		if strings.EqualFold(stack.Name, name) {
			return portainer.Error("Edge stack name must be unique")
		}
	}
	return nil
}
