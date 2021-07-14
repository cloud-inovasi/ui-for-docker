package migrator

import portainer "github.com/portainer/portainer/api"

func (m *Migrator) migrateDBVersionTo32() error {
	if err := m.migrateAdminGroupSearchSettings(); err != nil {
		return err
	}
	return nil
}

func (m *Migrator) migrateAdminGroupSearchSettings() error {
	legacySettings, err := m.settingsService.Settings()
	if err != nil {
		return err
	}
	if legacySettings.LDAPSettings.AdminGroupSearchSettings == nil {
		legacySettings.LDAPSettings.AdminGroupSearchSettings = []portainer.LDAPGroupSearchSettings{}
	}
	return m.settingsService.UpdateSettings(legacySettings)
}
