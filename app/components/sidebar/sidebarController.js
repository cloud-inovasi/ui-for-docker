angular.module('sidebar', [])
.controller('SidebarController', ['$q', '$scope', '$state', 'Settings', 'Config', 'EndpointService', 'StateManager', 'EndpointProvider', 'Notifications', 'Authentication', 'UserService',
function ($q, $scope, $state, Settings, Config, EndpointService, StateManager, EndpointProvider, Notifications, Authentication, UserService) {

  Config.$promise.then(function (c) {
    $scope.logo = c.logo;
  });

  $scope.uiVersion = Settings.uiVersion;
  $scope.endpoints = [];

  $scope.switchEndpoint = function(endpoint) {
    var activeEndpointID = EndpointProvider.endpointID();
    EndpointProvider.setEndpointID(endpoint.Id);
    StateManager.updateEndpointState(true)
    .then(function success() {
      $state.go('dashboard');
    })
    .catch(function error(err) {
      Notifications.error('Failure', err, 'Unable to connect to the Docker endpoint');
      EndpointProvider.setEndpointID(activeEndpointID);
      StateManager.updateEndpointState(true)
      .then(function success() {});
    });
  };

  function setActiveEndpoint(endpoints) {
    var activeEndpointID = EndpointProvider.endpointID();
    angular.forEach(endpoints, function (endpoint) {
      if (endpoint.Id === activeEndpointID) {
        $scope.activeEndpoint = endpoint;
      }
    });
  }

  function checkPermissions(memberships) {
    var isLeader = false;
    angular.forEach(memberships, function(membership) {
      if (membership.Role === 1) {
        isLeader = true;
      }
    });
    $scope.isTeamLeader = isLeader;
  }

  function initView() {
    var userDetails = Authentication.getUserDetails();
    var isAdmin = userDetails.role === 1 ? true: false;
    $scope.isAdmin = isAdmin;
    $q.all({
      endpoints: EndpointService.endpoints(),
      memberships: !isAdmin ? UserService.userMemberships(userDetails.ID) : null
    })
    .then(function success(data) {
      var endpoints = data.endpoints;
      $scope.endpoints = endpoints;
      setActiveEndpoint(endpoints);
      if (!isAdmin) {
        checkPermissions(data.memberships);
      }
    })
    .catch(function error(err) {
      Notifications.error('Failure', err, 'Unable to retrieve user information');
    });
  }

  initView();
}]);
