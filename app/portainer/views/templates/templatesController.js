import _ from 'lodash-es';
import { AccessControlFormData } from '../../components/accessControlForm/porAccessControlFormModel';

angular.module('portainer.app')
.controller('TemplatesController', ['$scope', '$q', '$state', '$transition$', '$anchorScroll', 'ContainerService', 'ImageService', 'NetworkService', 'TemplateService', 'TemplateHelper', 'VolumeService', 'Notifications', 'ResourceControlService', 'Authentication', 'FormValidator', 'SettingsService', 'StackService', 'EndpointProvider', 'ModalService',
function ($scope, $q, $state, $transition$, $anchorScroll, ContainerService, ImageService, NetworkService, TemplateService, TemplateHelper, VolumeService, Notifications, ResourceControlService, Authentication, FormValidator, SettingsService, StackService, EndpointProvider, ModalService) {
  $scope.state = {
    selectedTemplate: null,
    showAdvancedOptions: false,
    formValidationError: '',
    actionInProgress: false,
    templateManagement: true,
    stackNameAvailable: true
  };

  $scope.formValues = {
    network: '',
    name: '',
    AccessControlData: new AccessControlFormData()
  };

  $scope.addVolume = function () {
    $scope.state.selectedTemplate.Volumes.push({ containerPath: '', bind: '', readonly: false, type: 'auto' });
  };

  $scope.removeVolume = function(index) {
    $scope.state.selectedTemplate.Volumes.splice(index, 1);
  };

  $scope.addPortBinding = function() {
    $scope.state.selectedTemplate.Ports.push({ hostPort: '', containerPort: '', protocol: 'tcp' });
  };

  $scope.removePortBinding = function(index) {
    $scope.state.selectedTemplate.Ports.splice(index, 1);
  };

  $scope.addExtraHost = function() {
    $scope.state.selectedTemplate.Hosts.push('');
  };

  $scope.removeExtraHost = function(index) {
    $scope.state.selectedTemplate.Hosts.splice(index, 1);
  };

  $scope.addLabel = function () {
    $scope.state.selectedTemplate.Labels.push({ name: '', value: ''});
  };

  $scope.removeLabel = function(index) {
    $scope.state.selectedTemplate.Labels.splice(index, 1);
  };

  $scope.onStackNameChange = function(name) {
    $scope.state.stackNameAvailable = $scope.stackNames.indexOf(name) === -1;
  };

  function validateForm(accessControlData, isAdmin) {
    $scope.state.formValidationError = '';
    var error = '';
    error = FormValidator.validateAccessControl(accessControlData, isAdmin);

    if (error) {
      $scope.state.formValidationError = error;
      return false;
    }
    return true;
  }

  function createContainerFromTemplate(template, userId, accessControlData) {
    var templateConfiguration = createTemplateConfiguration(template);
    var generatedVolumeCount = TemplateHelper.determineRequiredGeneratedVolumeCount(template.Volumes);
    var generatedVolumeIds = [];
    VolumeService.createXAutoGeneratedLocalVolumes(generatedVolumeCount)
    .then(function success(data) {
      angular.forEach(data, function (volume) {
        var volumeId = volume.Id;
        generatedVolumeIds.push(volumeId);
      });
      TemplateService.updateContainerConfigurationWithVolumes(templateConfiguration, template, data);
      return ImageService.pullImage(template.Image, { URL: template.Registry }, true);
    })
    .then(function success() {
      return ContainerService.createAndStartContainer(templateConfiguration);
    })
    .then(function success(data) {
      var containerIdentifier = data.Id;
      return ResourceControlService.applyResourceControl('container', containerIdentifier, userId, accessControlData, generatedVolumeIds);
    })
    .then(function success() {
      Notifications.success('Container successfully created');
      $state.go('docker.containers', {}, {reload: true});
    })
    .catch(function error(err) {
      Notifications.error('Failure', err, err.msg);
    })
    .finally(function final() {
      $scope.state.actionInProgress = false;
    });
  }

  function createComposeStackFromTemplate(template, userId, accessControlData) {
    var stackName = $scope.formValues.name;

    for (var i = 0; i < template.Env.length; i++) {
      var envvar = template.Env[i];
      if (envvar.preset) {
        envvar.value = envvar.default;
      }
    }

    var repositoryOptions = {
      RepositoryURL: template.Repository.url,
      ComposeFilePathInRepository: template.Repository.stackfile
    };

    var endpointId = EndpointProvider.endpointID();
    StackService.createComposeStackFromGitRepository(stackName, repositoryOptions, template.Env, endpointId)
    .then(function success() {
      return ResourceControlService.applyResourceControl('stack', stackName, userId, accessControlData, []);
    })
    .then(function success() {
      Notifications.success('Stack successfully deployed');
      $state.go('portainer.stacks');
    })
    .catch(function error(err) {
      Notifications.warning('Deployment error', err.data.err);
    })
    .finally(function final() {
      $scope.state.actionInProgress = false;
    });
  }

  function createStackFromTemplate(template, userId, accessControlData) {
    var stackName = $scope.formValues.name;
    var env =_.filter(
        _.map(template.Env, function transformEnvVar(envvar) {
          return {
            name: envvar.name,
            value:
              envvar.preset || !envvar.value ? envvar.default : envvar.value
          };
        }),
        function removeUndefinedVars(envvar) {
          return envvar.value && envvar.name;
        }
      );

    var repositoryOptions = {
      RepositoryURL: template.Repository.url,
      ComposeFilePathInRepository: template.Repository.stackfile
    };

    var endpointId = EndpointProvider.endpointID();
    StackService.createSwarmStackFromGitRepository(stackName, repositoryOptions, env, endpointId)
    .then(function success() {
      return ResourceControlService.applyResourceControl('stack', stackName, userId, accessControlData, []);
    })
    .then(function success() {
      Notifications.success('Stack successfully deployed');
      $state.go('portainer.stacks');
    })
    .catch(function error(err) {
      Notifications.warning('Deployment error', err.err.data.err);
    })
    .finally(function final() {
      $scope.state.actionInProgress = false;
    });
  }

  $scope.createTemplate = function() {
    var userDetails = Authentication.getUserDetails();
    var userId = userDetails.ID;
    var accessControlData = $scope.formValues.AccessControlData;
    var isAdmin = userDetails.role === 1;

    if (!validateForm(accessControlData, isAdmin)) {
      return;
    }

    var template = $scope.state.selectedTemplate;

    $scope.state.actionInProgress = true;
    if (template.Type === 2) {
      createStackFromTemplate(template, userId, accessControlData);
    } else if (template.Type === 3) {
      createComposeStackFromTemplate(template, userId, accessControlData);
    } else {
      createContainerFromTemplate(template, userId, accessControlData);
    }
  };

  $scope.unselectTemplate = function(template) {
    template.Selected = false;
    $scope.state.selectedTemplate = null;
  };

  $scope.selectTemplate = function(template) {
    if ($scope.state.selectedTemplate) {
      $scope.unselectTemplate($scope.state.selectedTemplate);
    }

    template.Selected = true;
    if (template.Network) {
      $scope.formValues.network = _.find($scope.availableNetworks, function(o) { return o.Name === template.Network; });
    } else {
      $scope.formValues.network = _.find($scope.availableNetworks, function(o) { return o.Name === 'bridge'; });
    }

    $scope.formValues.name = template.Name ? template.Name : '';
    $scope.state.selectedTemplate = template;
    $anchorScroll('view-top');
  };

  function createTemplateConfiguration(template) {
    var network = $scope.formValues.network;
    var name = $scope.formValues.name;
    return TemplateService.createTemplateConfiguration(template, name, network);
  }

  $scope.deleteTemplate = function(template) {
    ModalService.confirmDeletion(
      'Do you want to delete this template?',
      function onConfirm(confirmed) {
        if(!confirmed) { return; }
        deleteTemplate(template);
      }
    );
  };

  function deleteTemplate(template) {
    TemplateService.delete(template.Id)
    .then(function success() {
      Notifications.success('Template successfully deleted');
      var idx = $scope.templates.indexOf(template);
      $scope.templates.splice(idx, 1);
    })
    .catch(function error(err) {
      Notifications.error('Failure', err, 'Unable to remove template');
    });
  }

  function initView() {
    var userDetails = Authentication.getUserDetails();
    $scope.isAdmin = userDetails.role === 1;

    var endpointMode = $scope.applicationState.endpoint.mode;
    var apiVersion = $scope.applicationState.endpoint.apiVersion;
    
     $q.all({
      templates: TemplateService.templates(),
      volumes: VolumeService.getVolumes(),
      networks: NetworkService.networks(
        endpointMode.provider === 'DOCKER_STANDALONE' || endpointMode.provider === 'DOCKER_SWARM_MODE',
        false,
        endpointMode.provider === 'DOCKER_SWARM_MODE' && apiVersion >= 1.25
      ),
      stacks: StackService.stacks(true, true, 0),
      settings: SettingsService.publicSettings()
    })
    .then(function success(data) {
      var templates =  data.templates;
      $scope.templates = templates;
      $scope.availableVolumes = data.volumes.Volumes;
      var networks = data.networks;
      $scope.availableNetworks = networks;
      var settings = data.settings;
      $scope.allowBindMounts = settings.AllowBindMountsForRegularUsers;
      $scope.state.templateManagement = !settings.ExternalTemplates;
      $scope.stackNames = data.stacks.map(function(x) {return x.Name;});
    })
    .catch(function error(err) {
      $scope.templates = [];
      $scope.stackNames = [];
      Notifications.error('Failure', err, 'An error occured during apps initialization.');
    });
  }

  initView();
}]);
