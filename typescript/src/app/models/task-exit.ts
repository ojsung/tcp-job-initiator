import { Worker } from "cluster";

export interface ITaskExit {
  worker: Worker
  code: number
  signal: string
}