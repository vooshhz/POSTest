import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("api", {
  // API methods will go here
});
