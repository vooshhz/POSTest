import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

export function getDatabasePaths() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev) {
    // Development paths - use current working directory
    return {
      productsDbPath: path.join(process.cwd(), 'LiquorDatabase.db'),
      inventoryDbPath: path.join(process.cwd(), 'LiquorInventory.db'),
      storeInfoDbPath: path.join(process.cwd(), 'StoreInformation.db')
    };
  } else {
    // Production paths
    const userDataPath = app.getPath('userData');
    const dbDir = path.join(userDataPath, 'databases');
    
    // Ensure database directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Check if databases exist in user data, if not copy from resources
    const resourcesPath = process.resourcesPath;
    
    const databases = [
      { name: 'LiquorDatabase.db', varName: 'productsDbPath' },
      { name: 'LiquorInventory.db', varName: 'inventoryDbPath' },
      { name: 'StoreInformation.db', varName: 'storeInfoDbPath' }
    ];
    
    const paths: any = {};
    
    for (const db of databases) {
      const userDbPath = path.join(dbDir, db.name);
      const resourceDbPath = path.join(resourcesPath, 'databases', db.name);
      
      // Copy database from resources if it doesn't exist in user data
      if (!fs.existsSync(userDbPath) && fs.existsSync(resourceDbPath)) {
        fs.copyFileSync(resourceDbPath, userDbPath);
        console.log(`Copied ${db.name} to user data directory`);
      }
      
      paths[db.varName] = userDbPath;
    }
    
    return paths;
  }
}