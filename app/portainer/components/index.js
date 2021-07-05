import angular from 'angular';

import gitFormModule from './forms/git-form';
import formComponentsModule from './form-components';

export default angular.module('portainer.app.components', [gitFormModule, formComponentsModule]).name;
