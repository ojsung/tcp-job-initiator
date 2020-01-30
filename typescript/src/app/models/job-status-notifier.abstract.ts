import { EventEmitter } from 'events'
import { ITaskExit } from './task-exit'
import { ITaskedChannelIdentifier } from './channel-identifier.interface'
import { ITaskError } from './task-error.interface'
import { ITaskData } from './task-data.interface'

/**
 * Job status notifier
 * @augments EventEmitter
 * This event emitter will emit the following events:
 * * (event: 'task-complete', taskdata: ITaskData) - Emit when a child process completes a task, and sends the data back up to the parent
 * * (event: 'worker-exit', taskExit: ITaskExit) - Emit when a child process exits properly
 * * (event: 'worker-error', taskError: ITaskError) - Emit when a child process errors out
 * * (event: 'unfinished-job', taskedChannelIdentifier: ITaskedChannelIdentifier) - Emit when a task cannot currently be completed by the child or the application and needs to be reassigned
 */
export abstract class JobStatusNotifier extends EventEmitter {
  public abstract emit(event: 'task-complete', taskData: ITaskData): boolean
  public abstract emit(event: 'worker-exit', taskExit: ITaskExit): boolean
  public abstract emit(event: 'worker-error', taskError: ITaskError): boolean
  public abstract emit(
    event: 'unfinished-job',
    taskedChannelIdentifier: ITaskedChannelIdentifier
  ): boolean
  public abstract on(event: 'task-complete', listener: (taskData: ITaskData) => void): this
  public abstract on(event: 'worker-exit', listener: (taskExit: ITaskExit) => void): this
  public abstract on(
    event: 'unfinished-job',
    listener: (taskedChannelIdentifier: ITaskedChannelIdentifier) => void
  ): this
  public abstract on(event: 'worker-error', listener: (taskError: ITaskError) => void): this

}