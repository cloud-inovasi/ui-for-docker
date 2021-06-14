package cli

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	kfake "k8s.io/client-go/kubernetes/fake"
)

func Test_GetServiceAccountName(t *testing.T) {

	t.Run("returns error if non-existent", func(t *testing.T) {
		k := &KubeClient{
			cli:        kfake.NewSimpleClientset(),
			instanceID: "test",
		}
		tokenData := &portainer.TokenData{ID: 1}
		_, err := k.GetServiceAccountName(tokenData)
		if err == nil {
			t.Error("GetServiceAccountName should fail with service account not found")
		}
	})

	t.Run("succeeds for cluster admin role", func(t *testing.T) {
		k := &KubeClient{
			cli:        kfake.NewSimpleClientset(),
			instanceID: "test",
		}

		tokenData := &portainer.TokenData{
			ID:       1,
			Role:     portainer.AdministratorRole,
			Username: portainerClusterAdminServiceAccountName,
		}
		serviceAccount := &v1.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name: tokenData.Username,
			},
		}
		_, err := k.cli.CoreV1().ServiceAccounts(portainerNamespace).Create(serviceAccount)
		if err != nil {
			t.Errorf("failed to create service acount; err=%s", err)
		}
		defer k.cli.CoreV1().ServiceAccounts(portainerNamespace).Delete(serviceAccount.Name, nil)

		saName, err := k.GetServiceAccountName(tokenData)
		if err != nil {
			t.Errorf("GetServiceAccountName should succeed; err=%s", err)
		}

		want := "portainer-sa-clusteradmin"
		if saName != want {
			t.Errorf("GetServiceAccountName should succeed and return correct sa name; got=%s want=%s", saName, want)
		}
	})

	t.Run("succeeds for standard user role", func(t *testing.T) {
		k := &KubeClient{
			cli:        kfake.NewSimpleClientset(),
			instanceID: "test",
		}

		tokenData := &portainer.TokenData{
			ID:   1,
			Role: portainer.StandardUserRole,
		}
		serviceAccountName := userServiceAccountName(int(tokenData.ID), k.instanceID)
		serviceAccount := &v1.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name: serviceAccountName,
			},
		}
		_, err := k.cli.CoreV1().ServiceAccounts(portainerNamespace).Create(serviceAccount)
		if err != nil {
			t.Errorf("failed to create service acount; err=%s", err)
		}
		defer k.cli.CoreV1().ServiceAccounts(portainerNamespace).Delete(serviceAccount.Name, nil)

		saName, err := k.GetServiceAccountName(tokenData)
		if err != nil {
			t.Errorf("GetServiceAccountName should succeed; err=%s", err)
		}

		want := "portainer-sa-user-test-1"
		if saName != want {
			t.Errorf("GetServiceAccountName should succeed and return correct sa name; got=%s want=%s", saName, want)
		}
	})

}
