import angular from 'angular';
import _ from 'lodash-es';
import filesizeParser from 'filesize-parser';
import {KubernetesPortainerQuotaSuffix, KubernetesResourceQuotaDefaults} from 'Kubernetes/models/resourceQuota';
import KubernetesDefaultLimitRangeModel from 'Kubernetes/models/limitRange';

function megaBytesValue(mem) {
  return Math.floor(mem / 1000 / 1000);
}

function bytesValue(mem) {
  return mem * 1000 * 1000;
}

class KubernetesEditResourcePoolController {
  /* @ngInject */
  constructor($async, $state, $transition$, Notifications, KubernetesNodeService, KubernetesResourceQuotaService, KubernetesResourcePoolService, KubernetesLimitRangeService, KubernetesEventService) {
    this.$async = $async;
    this.$state = $state;
    this.$transition$ = $transition$;
    this.Notifications = Notifications;

    this.KubernetesNodeService = KubernetesNodeService;
    this.KubernetesResourceQuotaService = KubernetesResourceQuotaService;
    this.KubernetesLimitRangeService = KubernetesLimitRangeService;
    this.KubernetesResourcePoolService = KubernetesResourcePoolService;
    this.KubernetesEventService = KubernetesEventService;

    this.onInit = this.onInit.bind(this);
    this.updateResourcePoolAsync = this.updateResourcePoolAsync.bind(this);
    this.getEvents = this.getEvents.bind(this);
    this.getEventsAsync = this.getEventsAsync.bind(this);
  }

  isQuotaValid() {
    if (this.state.sliderMaxCpu < this.formValues.CpuLimit
      || this.state.sliderMaxMemory < this.formValues.MemoryLimit
      || (this.formValues.CpuLimit === 0 && this.formValues.MemoryLimit === 0)) {
      return false;
    }
    return true;
  }

  checkDefaults() {
    if (this.formValues.CpuLimit < this.defaults.CpuLimit) {
      this.formValues.CpuLimit = this.defaults.CpuLimit;
    }
    if (this.formValues.MemoryLimit < megaBytesValue(this.defaults.MemoryLimit)) {
        this.formValues.MemoryLimit = megaBytesValue(this.defaults.MemoryLimit);
    }
  }

  showEditor() {
    this.state.showEditorTab = true;
  }

  async updateResourcePoolAsync() {
    this.state.actionInProgress = true;
    try {
      this.checkDefaults(); 
      const memoryLimit = bytesValue(this.formValues.MemoryLimit);
      const quota = _.find(this.pool.Quotas, (item) => item.Name === KubernetesPortainerQuotaSuffix + item.Namespace);

      if (this.formValues.hasQuota) {
        if (quota) {
          await this.KubernetesResourceQuotaService.update(quota.Raw, this.formValues.CpuLimit, memoryLimit);
          this.state.cpuUsed = quota.CpuLimitUsed;
          this.state.memoryUsed = megaBytesValue(quota.MemoryLimitUse);
          if (!this.pool.LimitRange) {
            const limitRange = new KubernetesDefaultLimitRangeModel(this.pool.Namespace.Name);
            await this.KubernetesLimitRangeService.create(limitRange, this.formValues.CpuLimit, memoryLimit);
          }
        } else {
          await this.KubernetesResourceQuotaService.create(this.pool.Namespace.Name, this.formValues.CpuLimit, memoryLimit);
          const limitRange = new KubernetesDefaultLimitRangeModel(this.pool.Namespace.Name);
          await this.KubernetesLimitRangeService.create(limitRange, this.formValues.CpuLimit, memoryLimit);
        }
      } else if (quota) {
        await this.KubernetesResourceQuotaService.remove(quota);
        if (this.pool.LimitRange) {
          await this.KubernetesLimitRangeService.remove(this.pool.LimitRange);
        }
      }

      this.Notifications.success('Resource pool successfully updated', this.pool.Namespace.Name);
      this.$state.reload();
    } catch (err) {
      this.Notifications.error('Failure', err, 'Unable to create resource pool');
    } finally {
      this.state.actionInProgress = false;
    }
  }

  updateResourcePool() {
    return this.$async(this.updateResourcePoolAsync);
  }

  async getEventsAsync() {
    try {
      this.state.eventsLoading = true;
      this.events = await this.KubernetesEventService.events(this.pool.Namespace.Name);
    } catch (err) {
      this.Notifications.error('Failure', err, 'Unable to retrieve resource pool related events');
    } finally {
      this.state.eventsLoading = false;
    }
  }

  getEvents() {
    return this.$async(this.getEventsAsync);
  }

  async onInit() {
    try {
      this.defaults = KubernetesResourceQuotaDefaults;

      this.formValues = {
        MemoryLimit: this.defaults.MemoryLimit,
        CpuLimit: this.defaults.CpuLimit,
        hasQuota: false
      };

      this.state = {
        actionInProgress: false,
        sliderMaxMemory: 0,
        sliderMaxCpu: 0,
        cpuUsage: 0,
        cpuUsed: 0,
        memoryUsage: 0,
        memoryUsed: 0,
        activeTab: 0,
        showEditorTab: false,
        eventsLoading: true
      };

      const name = this.$transition$.params().id;

      const [nodes, pool] = await Promise.all([
        this.KubernetesNodeService.get(),
        this.KubernetesResourcePoolService.resourcePool(name)
      ]);

      this.pool = pool;

      _.forEach(nodes, (item) => {
        this.state.sliderMaxMemory += filesizeParser(item.Memory);
        this.state.sliderMaxCpu += item.CPU;
      });
      this.state.sliderMaxMemory = megaBytesValue(this.state.sliderMaxMemory);

      const quota = _.find(pool.Quotas,
        (item) => item.Name === KubernetesPortainerQuotaSuffix + pool.Namespace.Name);
      if (quota) {
        this.formValues.hasQuota = true;
        this.formValues.CpuLimit = quota.CpuLimit;
        this.formValues.MemoryLimit = megaBytesValue(quota.MemoryLimit);

        this.state.cpuUsed = quota.CpuLimitUsed;
        this.state.memoryUsed = megaBytesValue(quota.MemoryLimitUsed);
      }

      this.getEvents();
    } catch (err) {
      this.Notifications.error('Failure', err, 'Unable to load view data');
    }
  }

  $onInit() {
    return this.$async(this.onInit);
  }
}

export default KubernetesEditResourcePoolController;
angular.module('portainer.kubernetes').controller('KubernetesEditResourcePoolController', KubernetesEditResourcePoolController);
