import { KubernetesConfigurationTypes } from './models';

/**
 * KubernetesConfigurationFormValues Model
 */
const _KubernetesConfigurationFormValues = Object.freeze({
  Id: '',
  ResourcePool: '',
  Name: '',
  ConfigurationOwner: '',
  Type: KubernetesConfigurationTypes.CONFIGMAP,
  Data: [],
  DataYaml: '',
  IsSimple: true,
});

export class KubernetesConfigurationFormValues {
  constructor() {
    Object.assign(this, JSON.parse(JSON.stringify(_KubernetesConfigurationFormValues)));
  }
}
