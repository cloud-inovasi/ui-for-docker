import angular from 'angular';
import KubernetesVolumeHelper from 'Kubernetes/helpers/volumeHelper';

// TODO: review - refactor to use `extends GenericDatatableController`
class KubernetesVolumesDatatableController {
  /* @ngInject */
  constructor($async, $controller, Authentication, KubernetesNamespaceHelper, DatatableService) {
    this.$async = $async;
    this.$controller = $controller;
    this.Authentication = Authentication;
    this.KubernetesNamespaceHelper = KubernetesNamespaceHelper;
    this.DatatableService = DatatableService;

    this.onInit = this.onInit.bind(this);
    this.allowSelection = this.allowSelection.bind(this);
  }

  disableRemove(item) {
    return this.isSystemNamespace(item) || this.isUsed(item);
  }

  isUsed(item) {
    return KubernetesVolumeHelper.isUsed(item);
  }

  isSystemNamespace(item) {
    return this.KubernetesNamespaceHelper.isSystemNamespace(item.ResourcePool.Namespace.Name);
  }

  allowSelection(item) {
    return !this.disableRemove(item);
  }

  async onInit() {
    this.setDefaults();
    this.prepareTableFromDataset();

    this.state.orderBy = this.orderBy;
    var storedOrder = this.DatatableService.getDataTableOrder(this.tableKey);
    if (storedOrder !== null) {
      this.state.reverseOrder = storedOrder.reverse;
      this.state.orderBy = storedOrder.orderBy;
    }

    var textFilter = this.DatatableService.getDataTableTextFilters(this.tableKey);
    if (textFilter !== null) {
      this.state.textFilter = textFilter;
      this.onTextFilterChange();
    }

    var storedFilters = this.DatatableService.getDataTableFilters(this.tableKey);
    if (storedFilters !== null) {
      this.filters = storedFilters;
    }
    if (this.filters && this.filters.state) {
      this.filters.state.open = false;
    }

    var storedSettings = this.DatatableService.getDataTableSettings(this.tableKey);
    if (storedSettings !== null) {
      this.settings = storedSettings;
      this.settings.open = false;
    }
    this.onSettingsRepeaterChange();
  }

  $onInit() {
    const ctrl = angular.extend({}, this.$controller('GenericDatatableController'), this);
    angular.extend(this, ctrl);
    return this.$async(this.onInit);
  }
}

export default KubernetesVolumesDatatableController;
angular.module('portainer.kubernetes').controller('KubernetesVolumesDatatableController', KubernetesVolumesDatatableController);
