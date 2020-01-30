import { ITaskedChannelIdentifier } from "./channel-identifier.interface";

interface IForkContainer {
  [fork: number]: IForkTracker
}

interface IForkTracker {
  jobsTaken: number
  cpuLoadValue: number
  cpuLoadIndex: number
  id: number
  currentJobs: ITaskedChannelIdentifier[]
}

export { IForkContainer, IForkTracker}