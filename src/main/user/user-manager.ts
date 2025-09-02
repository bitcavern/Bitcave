import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { UserSettings } from "../../shared/types";

const SETTINGS_DIR = path.join(os.homedir(), ".bitcave");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "user.json");

export class UserManager {
  private defaultSettings: UserSettings = {
    name: "User",
    interests: [],
    aiPersonality: "explanatory",
  };

  constructor() {
    this.ensureSettingsFileExists();
  }

  private async ensureSettingsFileExists(): Promise<void> {
    try {
      await fs.access(SETTINGS_FILE);
    } catch {
      await this.saveUserSettings(this.defaultSettings);
    }
  }

  async getUserSettings(): Promise<UserSettings> {
    try {
      const data = await fs.readFile(SETTINGS_FILE, "utf-8");
      return JSON.parse(data) as UserSettings;
    } catch (error) {
      console.error("Error reading user settings, returning defaults:", error);
      await this.ensureSettingsFileExists(); // Attempt to recreate if reading fails
      return this.defaultSettings;
    }
  }

  async saveUserSettings(settings: UserSettings): Promise<void> {
    try {
      await fs.mkdir(SETTINGS_DIR, { recursive: true });
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    } catch (error) {
      console.error("Error saving user settings:", error);
      throw error; // Re-throw to inform the caller
    }
  }
}
