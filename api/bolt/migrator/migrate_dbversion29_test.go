package migrator

import (
	"os"
	"path"
	"testing"
	"time"

	"github.com/boltdb/bolt"
	"github.com/portainer/portainer/api/bolt/internal"
	"github.com/portainer/portainer/api/bolt/settings"
)

var (
	testingDBStorePath string
	testingDBFileName  string
	dummyLogoURL       string
	dbConn             *bolt.DB
	settingsService    *settings.Service
)

// initTestingDBConn creates a raw bolt DB connection
// for unit testing usage only since using NewStore will cause cycle import inside migrator pkg
func initTestingDBConn(storePath, fileName string) (*bolt.DB, error) {
	databasePath := path.Join(storePath, fileName)
	dbConn, err := bolt.Open(databasePath, 0600, &bolt.Options{Timeout: 1 * time.Second})
	if err != nil {
		return nil, err
	}
	return dbConn, nil
}

// initTestingDBConn creates a settings service with raw bolt DB connection
// for unit testing usage only since using NewStore will cause cycle import inside migrator pkg
func initTestingSettingsService(dbConn *bolt.DB, preSetObj map[string]interface{}) (*settings.Service, error) {
	internalDBConn := &internal.DbConnection{
		DB: dbConn,
	}
	settingsService, err := settings.NewService(internalDBConn)
	if err != nil {
		return nil, err
	}
	//insert a obj
	if err := internal.UpdateObject(internalDBConn, "settings", []byte("SETTINGS"), preSetObj); err != nil {
		return nil, err
	}
	return settingsService, nil
}

func setup() error {
	testingDBStorePath, _ = os.Getwd()
	testingDBFileName = "portainer-ee-mig-30.db"
	dummyLogoURL = "example.com"
	var err error
	dbConn, err = initTestingDBConn(testingDBStorePath, testingDBFileName)
	if err != nil {
		return err
	}
	dummySettingsObj := map[string]interface{}{
		"LogoURL": dummyLogoURL,
	}
	settingsService, err = initTestingSettingsService(dbConn, dummySettingsObj)
	if err != nil {
		return err
	}
	return nil
}

func TestMigrateSettings(t *testing.T) {
	if err := setup(); err != nil {
		t.Errorf("failed to complete testing setups, err: %v", err)
	}
	defer dbConn.Close()
	defer os.Remove(testingDBFileName)
	m := &Migrator{
		db:              dbConn,
		settingsService: settingsService,
	}
	if err := m.migrateSettingsToDB30(); err != nil {
		t.Errorf("failed to update settings: %v", err)
	}
	updatedSettings, err := m.settingsService.Settings()
	if err != nil {
		t.Errorf("failed to retrieve the updated settings: %v", err)
	}
	if updatedSettings.LogoURL != dummyLogoURL {
		t.Errorf("unexpected value changes in the updated settings, want LogoURL value: %s, got LogoURL value: %s", dummyLogoURL, updatedSettings.LogoURL)
	}
	if updatedSettings.OAuthSettings.SSO != false {
		t.Errorf("unexpected default OAuth SSO setting, want: false, got: %t", updatedSettings.OAuthSettings.SSO)
	}
	if updatedSettings.OAuthSettings.LogoutURI != "" {
		t.Errorf("unexpected default OAuth HideInternalAuth setting, want:, got: %s", updatedSettings.OAuthSettings.LogoutURI)
	}
}
