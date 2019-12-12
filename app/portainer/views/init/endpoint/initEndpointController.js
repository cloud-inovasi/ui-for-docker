import _ from "lodash-es";
import angular from "angular";
import { InitEndpointFormValues } from "Portainer/models/formValues/initEndpointFormValues";
import { InitEndpointEndpointTypes } from "Portainer/models/formValues/initEndpointEndpointTypes";

class InitEndpointController {
  /* @ngInject */
  constructor($async, $scope, $state, EndpointService, StateManager, Notifications) {
    this.$async = $async;
    this.$scope = $scope;
    this.$state = $state;
    this.EndpointService = EndpointService;
    this.StateManager = StateManager;
    this.Notifications = Notifications;

    this.createLocalEndpointAsync = this.createLocalEndpointAsync.bind(this);
    this.createLocalKubernetesEndpointAsync = this.createLocalKubernetesEndpointAsync.bind(this);
    this.createAgentEndpointAsync = this.createAgentEndpointAsync.bind(this);
  }

  $onInit() {
    if (!_.isEmpty(this.$scope.applicationState.endpoint)) {
      this.$state.go("portainer.home");
    }
    this.logo = this.StateManager.getState().application.logo;

    this.state = {
      uploadInProgress: false,
      actionInProgress: false
    };

    this.formValues = new InitEndpointFormValues();
    this.endpointTypes = InitEndpointEndpointTypes;
  }

  async createLocalEndpointAsync() {
    try {
      this.state.actionInProgress = true;
      await this.EndpointService.createLocalEndpoint();
      this.$state.go("portainer.home");
    } catch (err) {
      this.Notifications.error("Failure", err, "Unable to connect to the Docker environment");
    } finally {
      this.state.actionInProgress = false;
    }
  }

  createLocalEndpoint() {
    return this.$async(this.createLocalEndpointAsync);
  }

  async createLocalKubernetesEndpointAsync() {
    try {
      this.state.actionInProgress = true;
      await this.EndpointService.createLocalKubernetesEndpoint();
      this.$state.go("portainer.home");
    } catch (err) {
      this.Notifications.error("Failure", err, "Unable to connect to the Kubernetes environment");
    } finally {
      this.state.actionInProgress = false;
    }
  }

  createLocalKubernetesEndpoint() {
    return this.$async(this.createLocalKubernetesEndpointAsync);
  }

  async createAgentEndpointAsync() {
    try {
      this.state.actionInProgress = true;
      const name = this.formValues.Name;
      const URL = this.formValues.URL;
      const PublicURL = URL.split(":")[0];
      await this.EndpointService.createRemoteEndpoint(name, 2, URL, PublicURL, 1, [], true, true, true, null, null, null);
      this.$state.go("portainer.home");
    } catch (err) {
      this.Notifications.error("Failure", err, "Unable to connect to the Docker environment");
    } finally {
      this.state.actionInProgress = false;
    }
  }

  createAgentEndpoint() {
    return this.$async(this.createAgentEndpointAsync);
  }
}

export default InitEndpointController;
angular.module("portainer.app").controller("InitEndpointController", InitEndpointController);
