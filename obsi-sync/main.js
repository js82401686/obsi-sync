const BACKEND_URL = "http://localhost:3000";

module.exports = class ObsiSyncPlugin extends require("obsidian").Plugin {
  async onload() {
    console.log("ObsiSync Plugin loaded. Checking backend health...");

    // Check if the backend is reachable
    const isBackendHealthy = await this.isBackendHealthy();

    if (!isBackendHealthy) {
      console.warn("Backend is not reachable. Sync will not start.");
      new Notice("ObsiSync Plugin: Backend not reachable. Sync disabled.");
      return;
    }

    console.log("Backend is healthy. Starting sync...");
    new Notice("ObsiSync Plugin: Backend reachable. Sync enabled.");

    // Event listener for file creation
    this.registerEvent(
      this.app.vault.on("create", async (file) => {
        if (file.extension === "md") {
          console.log(`File created: ${file.name}`);
          const content = await this.app.vault.read(file);
          await this.uploadImagesFromContent(content);
          this.sendToBackend([{ name: file.name, content }]);
        }
      })
    );

    // Event listener for file modification
    this.registerEvent(
      this.app.vault.on("modify", async (file) => {
        if (file.extension === "md") {
          console.log(`File modified: ${file.name}`);
          const content = await this.app.vault.read(file);
          await this.uploadImagesFromContent(content);
          this.sendToBackend([{ name: file.name, content }]);
        }
      })
    );

    // Event listener for file deletion
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (["md"].includes(file.extension)) {
          console.log(`Note deleted: ${file.name}`);
          this.deleteFromBackend(file.name);
        } else if (["png", "jpg", "jpeg", "gif"].includes(file.extension)) {
          console.log(`Image deleted: ${file.name}`);
          this.deleteFromBackend(file.name); // Handles images
        }
      })
    );

    // Event listener for file renaming
    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        if (file.extension === "md") {
          const oldName = oldPath.split("/").pop(); // Extract old file name
          console.log(`File renamed: ${oldName} -> ${file.name}`);

          // Delete the old note
          this.deleteFromBackend(oldName);

          // Add the new note
          const content = await this.app.vault.read(file);
          await this.uploadImagesFromContent(content);
          this.sendToBackend([{ name: file.name, content }]);
        }
      })
    );
  }

  onunload() {
    console.log("ObsiSync Plugin unloaded.");
  }

  async isBackendHealthy() {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      if (response.ok) {
        console.log("Backend is healthy.");
        return true;
      }
    } catch (error) {
      console.warn("Backend is not reachable:", error);
    }
    return false;
  }

  async sendToBackend(notes) {
    try {
      console.log("Sending notes to backend:", notes);
      const response = await fetch(`${BACKEND_URL}/api/notes/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notes),
      });

      if (response.ok) {
        console.log("Notes pushed successfully!");
      } else {
        console.error("Failed to push notes:", response.statusText);
      }
    } catch (error) {
      console.error("Error pushing notes:", error);
    }
  }

  async deleteFromBackend(filename) {
    try {
      const isImage = /\.(png|jpg|jpeg|gif)$/i.test(filename); // Check if it's an image
      const endpoint = isImage ? '/api/delete-image' : '/api/notes/delete';

      // Sanitize the filename to match the backend's naming
      const sanitizedFilename = filename.replace(/\s+/g, "_");

      console.log(`Deleting file from backend: ${sanitizedFilename}`);
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sanitizedFilename }),
      });

      if (response.ok) {
        console.log(`File "${sanitizedFilename}" deleted successfully.`);
      } else {
        console.error(`Failed to delete file: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error deleting file: ${filename}`, error);
    }
  }

  async uploadImagesFromContent(content) {
    const imageRegex = /!\[\[(.*?)\]\]/g; // Matches Obsidian image syntax ![[image.png]]
    let match;

    while ((match = imageRegex.exec(content)) !== null) {
      const imageName = match[1].trim();
      const imageFile = this.app.vault.getAbstractFileByPath(imageName);

      if (imageFile) {
        console.log(`Uploading image: ${imageName}`);
        const imageData = await this.app.vault.readBinary(imageFile);
        await this.uploadImageToBackend(imageName, imageData);
      } else {
        console.warn(`Image not found in vault: ${imageName}`);
      }
    }
  }

  async uploadImageToBackend(fileName, imageData) {
    const formData = new FormData();
    formData.append("file", new Blob([imageData]), fileName);

    try {
      const response = await fetch(`${BACKEND_URL}/api/upload-image`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        console.log(`Image uploaded: ${fileName}`);
      } else {
        console.error(`Failed to upload image: ${fileName}`, response.statusText);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
    }
  }
};
