interface IForkContainer {
  [fork: number]: IForkTracker
}

interface IForkTracker {
  jobsTaken: number
  cpuLoadValue: number
  id: number
}

export { IForkContainer, IForkTracker}