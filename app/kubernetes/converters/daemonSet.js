import {KubernetesDaemonSet} from 'Kubernetes/models/daemon-set/models';
import {KubernetesDaemonSetCreatePayload, KubernetesDaemonSetPatchPayload} from 'Kubernetes/models/daemon-set/payloads';
import {KubernetesPortainerApplicationStackNameLabel, KubernetesPortainerApplicationNameLabel, KubernetesPortainerApplicationOwnerLabel, KubernetesPortainerApplicationNote } from 'Kubernetes/models/application/models';
import KubernetesApplicationHelper from 'Kubernetes/helpers/applicationHelper';

function bytesValue(mem) {
  return mem * 1000 * 1000;
}

class KubernetesDaemonSetConverter {
  /**
   * Generate KubernetesDaemonSet from KubenetesApplicationFormValues
   * @param {KubernetesApplicationFormValues} formValues
   */
  static applicationFormValuesToDaemonSet(formValues) {
    const res = new KubernetesDaemonSet();
    res.Namespace = formValues.ResourcePool.Namespace.Name;
    res.Name = formValues.Name;
    res.StackName = formValues.StackName ? formValues.StackName : formValues.Name;
    res.ApplicationOwner = formValues.ApplicationOwner;
    res.Image = formValues.Image;
    res.Env = [];
    res.CpuLimit = formValues.CpuLimit;
    res.MemoryLimit = bytesValue(formValues.MemoryLimit);
    KubernetesApplicationHelper.generateEnvFromEnvVariables(res, formValues.EnvironmentVariables);
    KubernetesApplicationHelper.generateVolumesFromPersistedFolders(res, formValues.PersistedFolders);
    KubernetesApplicationHelper.generateEnvOrVolumesFromConfigurations(res, formValues.Configurations);
    return res;
  }

  /**
   * Generate CREATE payload from DaemonSet
   * @param {KubernetesDaemonSetPayload} model DaemonSet to genereate payload from
   */
  static createPayload(daemonSet) {
    const payload = new KubernetesDaemonSetCreatePayload();
    payload.metadata.name = daemonSet.Name;
    payload.metadata.namespace = daemonSet.Namespace;
    payload.metadata.labels[KubernetesPortainerApplicationStackNameLabel] = daemonSet.StackName;
    payload.metadata.labels[KubernetesPortainerApplicationNameLabel] = daemonSet.Name;
    payload.metadata.labels[KubernetesPortainerApplicationOwnerLabel] = daemonSet.ApplicationOwner;
    payload.spec.replicas = daemonSet.ReplicaCount;
    payload.spec.selector.matchLabels.app = daemonSet.Name;
    payload.spec.template.metadata.labels.app = daemonSet.Name;
    payload.spec.template.spec.containers[0].name = daemonSet.Name;
    payload.spec.template.spec.containers[0].image = daemonSet.Image;
    payload.spec.template.spec.containers[0].env = daemonSet.Env;
    payload.spec.template.spec.containers[0].volumeMounts = daemonSet.VolumeMounts;
    payload.spec.template.spec.volumes = daemonSet.Volumes;
    if (daemonSet.MemoryLimit) {
      payload.spec.template.spec.containers[0].resources.limits.memory = daemonSet.MemoryLimit;
      payload.spec.template.spec.containers[0].resources.requests.memory = daemonSet.MemoryLimit;
    }
    if (daemonSet.CpuLimit) {
      payload.spec.template.spec.containers[0].resources.limits.cpu = daemonSet.CpuLimit;
      payload.spec.template.spec.containers[0].resources.requests.cpu = daemonSet.CpuLimit;
    }
    return payload;
  }

  static patchPayload(daemonSet) {
    const payload = new KubernetesDaemonSetPatchPayload();
    delete payload.metadata.uid;
    delete payload.metadata.name;
    delete payload.metadata.namespace;
    payload.metadata.labels[KubernetesPortainerApplicationStackNameLabel] = daemonSet.StackName;
    payload.metadata.annotations[KubernetesPortainerApplicationNote] = daemonSet.Note;
    return payload;
  }
}

export default KubernetesDaemonSetConverter;