package migrator

func (m *Migrator) migrateDBVersionToDB30() error {
	if err := m.migrateSettingsToDB30(); err != nil {
		return err
	}

	return nil
}

func (m *Migrator) migrateSettingsToDB30() error {
	legacySettings, err := m.settingsService.Settings()
	if err != nil {
		return err
	}
	legacySettings.OAuthSettings.SSO = false
	legacySettings.OAuthSettings.LogoutURI = ""
	return m.settingsService.UpdateSettings(legacySettings)
}
