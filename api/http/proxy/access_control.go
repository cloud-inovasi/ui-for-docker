package proxy

import (
	"log"

	"github.com/portainer/portainer"
)

type (
	// ExtendedStack represents a stack combined with its associated access control
	ExtendedStack struct {
		portainer.Stack
		ResourceControl portainer.ResourceControl `json:"ResourceControl"`
	}
)

// applyResourceAccessControlFromLabel returns an optionally decorated object as the first return value and the
// access level for the user (granted or denied) as the second return value.
// It will retrieve an identifier from the labels object. If an identifier exists, it will check for
// an existing resource control associated to it.
// Returns a decorated object and authorized access (true) when a resource control is found and the user can access the resource.
// Returns the original object and authorized access (true) when no resource control is found.
// Returns the original object and denied access (false) when a resource control is found and the user cannot access the resource.
func applyResourceAccessControlFromLabel(labelsObject, resourceObject map[string]interface{}, labelIdentifier string,
	context *restrictedOperationContext) (map[string]interface{}, bool) {

	if labelsObject != nil && labelsObject[labelIdentifier] != nil {
		resourceIdentifier := labelsObject[labelIdentifier].(string)
		return applyResourceAccessControl(resourceObject, resourceIdentifier, context)
	}
	return resourceObject, true
}

// applyResourceAccessControl returns an optionally decorated object as the first return value and the
// access level for the user (granted or denied) as the second return value.
// Returns a decorated object and authorized access (true) when a resource control is found to the specified resource
// identifier and the user can access the resource.
// Returns the original object and authorized access (false) when no resource control is found for the specified
// resource identifier.
// Returns the original object and denied access (false) when a resource control is associated to the resource
// and the user cannot access the resource.
func applyResourceAccessControl(resourceObject map[string]interface{}, resourceIdentifier string,
	context *restrictedOperationContext) (map[string]interface{}, bool) {

	authorizedAccess := context.isAdmin

	resourceControl := getResourceControlByResourceID(resourceIdentifier, context.resourceControls)
	if resourceControl != nil {
		if context.isAdmin || resourceControl.Public || canUserAccessResource(context.userID, context.userTeamIDs, resourceControl) {
			resourceObject = decorateObject(resourceObject, resourceControl)
			authorizedAccess = true
		}
	}

	return resourceObject, authorizedAccess
}

// decorateResourceWithAccessControlFromLabel will retrieve an identifier from the labels object. If an identifier exists,
// it will check for an existing resource control associated to it. If a resource control is found, the resource object will be
// decorated. If no identifier can be found in the labels or no resource control is associated to the identifier, the resource
// object will not be changed.
func decorateResourceWithAccessControlFromLabel(labelsObject, resourceObject map[string]interface{}, labelIdentifier string,
	resourceControls []portainer.ResourceControl) map[string]interface{} {

	if labelsObject != nil && labelsObject[labelIdentifier] != nil {
		resourceIdentifier := labelsObject[labelIdentifier].(string)
		resourceObject = decorateResourceWithAccessControl(resourceObject, resourceIdentifier, resourceControls)
	}

	return resourceObject
}

// decorateResourceWithAccessControl will check if a resource control is associated to the specified resource identifier.
// If a resource control is found, the resource object will be decorated, otherwise it will not be changed.
func decorateResourceWithAccessControl(resourceObject map[string]interface{}, resourceIdentifier string,
	resourceControls []portainer.ResourceControl) map[string]interface{} {

	resourceControl := getResourceControlByResourceID(resourceIdentifier, resourceControls)
	if resourceControl != nil {
		return decorateObject(resourceObject, resourceControl)
	}
	return resourceObject
}

func canUserAccessResource(userID portainer.UserID, userTeamIDs []portainer.TeamID, resourceControl *portainer.ResourceControl) bool {
	for _, authorizedUserAccess := range resourceControl.UserAccesses {
		if userID == authorizedUserAccess.UserID {
			return true
		}
	}

	for _, authorizedTeamAccess := range resourceControl.TeamAccesses {
		for _, userTeamID := range userTeamIDs {
			if userTeamID == authorizedTeamAccess.TeamID {
				return true
			}
		}
	}

	log.Printf("resourceControl.Public %+v\n", resourceControl.Public)
	return resourceControl.Public
}

func decorateObject(object map[string]interface{}, resourceControl *portainer.ResourceControl) map[string]interface{} {
	if object["Portainer"] == nil {
		object["Portainer"] = make(map[string]interface{})
	}

	portainerMetadata := object["Portainer"].(map[string]interface{})
	portainerMetadata["ResourceControl"] = resourceControl
	return object
}

func getResourceControlByResourceID(resourceID string, resourceControls []portainer.ResourceControl) *portainer.ResourceControl {
	for _, resourceControl := range resourceControls {
		if resourceID == resourceControl.ResourceID {
			return &resourceControl
		}
		for _, subResourceID := range resourceControl.SubResourceIDs {
			if resourceID == subResourceID {
				return &resourceControl
			}
		}
	}
	return nil
}

// CanAccessStack checks if a user can access a stack
func CanAccessStack(stack *portainer.Stack, resourceControl *portainer.ResourceControl, userID portainer.UserID, memberships []portainer.TeamMembership) bool {
	userTeamIDs := make([]portainer.TeamID, 0)
	for _, membership := range memberships {
		userTeamIDs = append(userTeamIDs, membership.TeamID)
	}

	if canUserAccessResource(userID, userTeamIDs, resourceControl) {
		return true
	}

	return false
}

// FilterStacks filters stacks based on user role and resource controls.
func FilterStacks(stacks []portainer.Stack, resourceControls []portainer.ResourceControl, isAdmin bool,
	userID portainer.UserID, memberships []portainer.TeamMembership) []ExtendedStack {

	filteredStacks := make([]ExtendedStack, 0)

	userTeamIDs := make([]portainer.TeamID, 0)
	for _, membership := range memberships {
		userTeamIDs = append(userTeamIDs, membership.TeamID)
	}

	for _, stack := range stacks {
		extendedStack := ExtendedStack{stack, portainer.ResourceControl{}}
		resourceControl := getResourceControlByResourceID(stack.Name, resourceControls)
		if resourceControl == nil {
			filteredStacks = append(filteredStacks, extendedStack)
		} else if resourceControl != nil && (isAdmin || canUserAccessResource(userID, userTeamIDs, resourceControl)) {
			extendedStack.ResourceControl = *resourceControl
			filteredStacks = append(filteredStacks, extendedStack)
		}
	}

	return filteredStacks
}
