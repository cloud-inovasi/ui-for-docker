angular.module('portainer.app').factory('Settings', [
  '$resource',
  'API_ENDPOINT_SETTINGS',
  function SettingsFactory($resource, API_ENDPOINT_SETTINGS) {
    'use strict';
    return $resource(
      API_ENDPOINT_SETTINGS + '/:subResource/:action',
      {},
      {
        get: { method: 'GET' },
        update: { method: 'PUT', ignoreLoadingBar: true },
        publicSettings: { method: 'GET', params: { subResource: 'public' }, ignoreLoadingBar: true },
        checkLDAPConnectivity: { method: 'PUT', params: { subResource: 'authentication', action: 'checkLDAP' } },
        searchLdapGroups: { method: 'GET', params: { action: 'searchLdapGroups' } },
      }
    );
  },
]);
