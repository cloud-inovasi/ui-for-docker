angular.module('portainer.app')
.controller('SettingsController', ['$scope', '$state', 'Notifications', 'SettingsService', 'StateManager', /*'DEFAULT_TEMPLATES_URL',*/
function ($scope, $state, Notifications, SettingsService, StateManager/*, DEFAULT_TEMPLATES_URL*/) {

  $scope.state = {
    actionInProgress: false
  };

  $scope.formValues = {
    customLogo: false,
    externalTemplates: false,
    restrictBindMounts: false,
    restrictPrivilegedMode: false,
    labelName: '',
    labelValue: ''
  };

  $scope.removeFilteredContainerLabel = function(index) {
    var settings = $scope.settings;
    settings.BlackListedLabels.splice(index, 1);

    updateSettings(settings);
  };

  $scope.addFilteredContainerLabel = function() {
    var settings = $scope.settings;
    var label = {
      name: $scope.formValues.labelName,
      value: $scope.formValues.labelValue
    };
    settings.BlackListedLabels.push(label);

    updateSettings(settings);
  };

  $scope.saveApplicationSettings = function() {
    var settings = $scope.settings;

    if (!$scope.formValues.customLogo) {
      settings.LogoURL = '';
    }

    if (!$scope.formValues.externalTemplates) {
      settings.TemplatesURL = '';
    }

    settings.AllowBindMountsForRegularUsers = !$scope.formValues.restrictBindMounts;
    settings.AllowPrivilegedModeForRegularUsers = !$scope.formValues.restrictPrivilegedMode;

    $scope.state.actionInProgress = true;
    updateSettings(settings);
  };

  function updateSettings(settings) {
    SettingsService.update(settings)
    .then(function success() {
      Notifications.success('Settings updated');
      StateManager.updateLogo(settings.LogoURL);
      StateManager.updateSnapshotInterval(settings.SnapshotInterval);
      $state.reload();
    })
    .catch(function error(err) {
      Notifications.error('Failure', err, 'Unable to update settings');
    })
    .finally(function final() {
      $scope.state.actionInProgress = false;
    });
  }

  function initView() {
    SettingsService.settings()
    .then(function success(data) {
      var settings = data;
      $scope.settings = settings;
      if (settings.LogoURL !== '') {
        $scope.formValues.customLogo = true;
      }
      if (settings.TemplatesURL !== '') {
        $scope.formValues.externalTemplates = true;
      }
      $scope.formValues.restrictBindMounts = !settings.AllowBindMountsForRegularUsers;
      $scope.formValues.restrictPrivilegedMode = !settings.AllowPrivilegedModeForRegularUsers;
    })
    .catch(function error(err) {
      Notifications.error('Failure', err, 'Unable to retrieve application settings');
    });
  }

  initView();
}]);
