import angular from 'angular';
import {
  KubernetesApplicationDeploymentTypes,
  KubernetesApplicationEnvironmentVariableFormValue,
  KubernetesApplicationFormValues,
  KubernetesApplicationPersistedFolderFormValue,
  KubernetesApplicationPublishedPortFormValue,
  KubernetesApplicationPublishingTypes
} from 'Kubernetes/models/application';

class KubernetesCreateApplicationController {
  /* @ngInject */
  constructor($async, $state, Notifications, KubernetesResourcePoolService, KubernetesApplicationService) {
    this.$async = $async;
    this.$state = $state;
    this.Notifications = Notifications;
    this.KubernetesResourcePoolService = KubernetesResourcePoolService;
    this.KubernetesApplicationService = KubernetesApplicationService;

    this.onInit = this.onInit.bind(this);
    this.deployApplicationAsync = this.deployApplicationAsync.bind(this);
  }

  addEnvironmentVariable() {
    this.formValues.EnvironmentVariables.push(new KubernetesApplicationEnvironmentVariableFormValue());
  }

  removeEnvironmentVariable(index) {
    this.formValues.EnvironmentVariables.splice(index, 1);
  }

  hasEnvironmentVariables() {
    return this.formValues.EnvironmentVariables.length > 0;
  }

  addPersistedFolder() {
    this.formValues.PersistedFolders.push(new KubernetesApplicationPersistedFolderFormValue());
  }

  removePersistedFolder(index) {
    this.formValues.PersistedFolders.splice(index, 1);
  }

  addPublishedPort() {
    this.formValues.PublishedPorts.push(new KubernetesApplicationPublishedPortFormValue());
  }

  removePublishedPort(index) {
    this.formValues.PublishedPorts.splice(index, 1);
  }

  // TODO: temporary mock, should be updated based on endpoint kubernetes configuration
  storageClassAvailable() {
    return true;
  }

  // TODO: temporary mock, should be updated based on endpoint kubernetes configuration
  hasMultipleStorageClassesAvailable() {
    return true;
  }

  // TODO: temporary mock, should be updated based on endpoint kubernetes configuration
  publishViaLoadBalancerEnabled() {
    return true;
  }

  async deployApplicationAsync() {
    this.state.actionInProgress = true;
    try {
      // TODO: review @LP
      // Ultimately using the approach I proposed, it make the controller code quite clear and most of the function
      // are only associated to model/view manipulation.
      await this.KubernetesApplicationService.create(this.formValues);

      // TODO: review @LP
      // even if the create above fails (deployment/daemonset create request fails and/or service create request fails)
      // it stills show a success notification
      this.Notifications.success('Application successfully deployed', this.formValues.Name);
      this.$state.go('kubernetes.applications');
    } catch (err) {
      this.Notifications.error('Failure', err, 'Unable to create application');
    } finally {
      this.state.actionInProgress = false;
    }
  }

  deployApplication() {
    return this.$async(this.deployApplicationAsync);
  }

  async onInit() {
    try {
      this.formValues = new KubernetesApplicationFormValues();

      this.state = {
        actionInProgress: false,
      };

      this.ApplicationDeploymentTypes = KubernetesApplicationDeploymentTypes;
      this.ApplicationPublishingTypes = KubernetesApplicationPublishingTypes;

      this.resourcePools = await this.KubernetesResourcePoolService.resourcePools();
      this.formValues.ResourcePool = this.resourcePools[0];

      // Part of the endpoint Kubernetes configuration
      this.storageClasses = [];

      this.stacks = [];

    } catch (err) {
      this.Notifications.error('Failure', err, 'Unable to load view data');
    }
  }

  $onInit() {
    return this.$async(this.onInit);
  }
}

export default KubernetesCreateApplicationController;
angular.module('portainer.kubernetes').controller('KubernetesCreateApplicationController', KubernetesCreateApplicationController);
