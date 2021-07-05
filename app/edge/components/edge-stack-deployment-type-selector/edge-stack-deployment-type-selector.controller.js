export default class EdgeStackDeploymentTypeSelectorController {
  /* @ngInject */
  constructor() {
    this.deploymentOptions = [
      { id: 'deployment_compose', icon: 'fab fa-docker', label: 'Compose', description: 'docker-compose format', value: 0 },
      {
        id: 'deployment_kube',
        icon: 'fab fa-kubernetes',
        label: 'Kubernetes',
        description: 'Kubernetes manifest format',
        value: 1,
        disabled: () => {
          return this.hasDockerEndpoint();
        },
        tooltip: () => {
          return this.hasDockerEndpoint() ? 'Cannot use this option with Edge Docker endpoints' : '';
        },
      },
    ];
  }
}
