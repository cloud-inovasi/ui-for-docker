/**
 * ResourcePool is a composite model that includes
 * A Namespace, a list of quotas (most of the time only 1 resource quotas)
 * and a LimitRange if it contains a resource quota
 * @param {KubernetesNamespaceViewModel} namespace
 */
export default function KubernetesResourcePoolViewModel(namespace) {
  this.Namespace = namespace;
  this.Quotas = [];
  this.LimitRange = {};
}
