angular.module('portainer.app').controller('UserController', [
  '$q',
  '$scope',
  '$state',
  '$transition$',
  'UserService',
  'ModalService',
  'Notifications',
  'SettingsService',
  'Authentication',
  function ($q, $scope, $state, $transition$, UserService, ModalService, Notifications, SettingsService, Authentication) {
    $scope.state = {
      updatePasswordError: '',
    };

    $scope.formValues = {
      username: '',
      newPassword: '',
      confirmPassword: '',
      Administrator: false,
    };

    $scope.deleteUser = function () {
      ModalService.confirmDeletion('Do you want to remove this user? This user will not be able to login into Portainer anymore.', function onConfirm(confirmed) {
        if (!confirmed) {
          return;
        }
        deleteUser();
      });
    };

    $scope.updateUser = function () {
      const role = $scope.formValues.Administrator ? 1 : 2;
      const username = $scope.formValues.username;
      UserService.updateUser($scope.user.Id, { role, username })
        .then(function success() {
          const newRole = role === 1 ? 'administrator' : 'user';
          Notifications.success('User successfully updated', `${username} is now ${newRole}`);
          $state.reload();
        })
        .catch(function error(err) {
          Notifications.error('Failure', err, 'Unable to update user permissions');
        });
    };

    $scope.updatePassword = function () {
      UserService.updateUser($scope.user.Id, { password: $scope.formValues.newPassword })
        .then(function success() {
          Notifications.success('Password successfully updated');
          $state.reload();
        })
        .catch(function error(err) {
          Notifications.error('Failure', err, 'Unable to update user password');
        });
    };

    function deleteUser() {
      UserService.deleteUser($scope.user.Id)
        .then(function success() {
          Notifications.success('User successfully deleted', $scope.user.Username);
          $state.go('portainer.users');
        })
        .catch(function error(err) {
          Notifications.error('Failure', err, 'Unable to remove user');
        });
    }

    function initView() {
      $scope.isAdmin = Authentication.isAdmin();

      $q.all({
        user: UserService.user($transition$.params().id),
        settings: SettingsService.publicSettings(),
      })
        .then(function success(data) {
          var user = data.user;
          $scope.user = user;
          $scope.formValues.Administrator = user.Role === 1;
          $scope.formValues.username = user.Username;
          $scope.AuthenticationMethod = data.settings.AuthenticationMethod;
        })
        .catch(function error(err) {
          Notifications.error('Failure', err, 'Unable to retrieve user information');
        });
    }

    initView();
  },
]);
