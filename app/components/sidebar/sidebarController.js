angular.module('sidebar', [])
.controller('SidebarController', ['$scope', '$state', 'Settings', 'Config', 'EndpointService', 'StateManager', 'EndpointProvider', 'Notifications', 'Authentication',
function ($scope, $state, Settings, Config, EndpointService, StateManager, EndpointProvider, Notifications, Authentication) {

  Config.$promise.then(function (c) {
    $scope.logo = c.logo;
  });

  $scope.uiVersion = Settings.uiVersion;
  $scope.userRole = Authentication.getUserDetails().role;

  $scope.switchEndpoint = function(endpoint) {
    var activeEndpointID = EndpointProvider.endpointID();
    var activeEndpointURLPublish = EndpointProvider.endpointURLPublish();
    EndpointProvider.setEndpointID(endpoint.Id);
    EndpointProvider.setEndpointURLPublish(endpoint.URLPublish);
    StateManager.updateEndpointState(true)
    .then(function success() {
      $state.go('dashboard');
    })
    .catch(function error(err) {
      Notifications.error("Failure", err, "Unable to connect to the Docker endpoint");
      EndpointProvider.setEndpointID(activeEndpointID);
      EndpointProvider.setEndpointURLPublish(activeEndpointURLPublish);
      StateManager.updateEndpointState(true)
      .then(function success() {});
    });
  };

  function fetchEndpoints() {
    EndpointService.endpoints()
    .then(function success(data) {
      $scope.endpoints = data;
      var activeEndpointID = EndpointProvider.endpointID();
      angular.forEach($scope.endpoints, function (endpoint) {
        if (endpoint.Id === activeEndpointID) {
          $scope.activeEndpoint = endpoint;
          EndpointProvider.setEndpointURLPublish(endpoint.URLPublish);
        }
      });
    })
    .catch(function error(err) {
      $scope.endpoints = [];
    });
  }

  fetchEndpoints();
}]);
