const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Store {
  constructor(options = {}) {
    this.path = options.path || path.join(app.getPath('userData'), 'config.json');
    this.data = {};
    this.defaults = options.defaults || {};
    
    // Create directory if it doesn't exist
    const dir = path.dirname(this.path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Load data from file if it exists
    this.load();
    
    // Apply defaults for keys that don't exist
    for (const key in this.defaults) {
      if (this.data[key] === undefined) {
        this.data[key] = this.defaults[key];
      }
    }
  }
  
  load() {
    try {
      if (fs.existsSync(this.path)) {
        const fileData = fs.readFileSync(this.path, 'utf8');
        this.data = JSON.parse(fileData);
      }
    } catch (error) {
      console.error('Error loading data from store:', error);
      this.data = {};
    }
  }
  
  save() {
    try {
      fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving data to store:', error);
    }
  }
  
  get(key) {
    return key ? this.data[key] : this.data;
  }
  
  set(key, value) {
    this.data[key] = value;
    this.save();
  }
  
  delete(key) {
    delete this.data[key];
    this.save();
  }
  
  clear() {
    this.data = {};
    this.save();
  }
}

module.exports = Store;