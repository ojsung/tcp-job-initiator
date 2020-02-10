# tcp-job-initiator

## Description

This module is meant to be used alongside JobRequestor, but doesn't necessarily need to be.
It exports the class "TCPJobInitiator" as its default export. Once a Job Requestor has found a Job Acceptor,
this class's initiateJobRequest function can be called to initiate that job.

Additionally, if this class's deathMonitor event emitter is triggered to emit a "die" event, this class will
begin cleaning up all unfinished tasks, and stop accepting new ones. The event "undie" can also be emitted, which will
cause the class to resume operation, but it shouldn't be used. Once "die" is emitted, this node process should be killed and restarted altogether.

This is designed to only have one instance running at a time. In fact, deathMonitor is a static resource. If multiple instances of this class are created,
they will all kill themselves when "die" is emitted from deathMontior.

## Models

```typescript
interface IChannelIdentifier {
  requesterIp: string
  responderIp: string
  targetIp: string
  jobId: string
  params:
    | string
    | number
    | bigint
    | boolean
    | null
    | undefined
    | Array<string | number | bigint | boolean | null | undefined>
}

interface ITaskError {
  taskedIdentifier: ITaskedChannelIdentifier
  error: Error
  data?: ITCPDataResponse
}

```

## Properties

```typescript
/**
 * This event emitter will be used to let the app know it needs to die.
 * I could add that functionality into the errorAndResponseNotifier event emitter.
 * But that is messy.  They have different jobs, they should be different emitters.
 *
 * The only two listeners for deathMonitor are 'die', which instructs the app to begin prepping for death,
 * or 'undie', which instructs the app to resume business as usual.  I can't see any reason why
 * we'd ever want to 'undie' the app, rather than just letting it die and rebooting it.  But you never know.
 */
public static readonly deathMonitor: EventEmitter = new EventEmitter()

/**
 * Job status notifier
 * @augments EventEmitter
 * This event emitter will emit the following events:
 * * (event: 'task-complete', taskdata: ITaskData) - Emit when a child process completes a task, and sends the data back up to the parent
 * * (event: 'worker-exit', taskExit: ITaskExit) - Emit when a child process exits properly
 * * (event: 'worker-error', taskError: ITaskError) - Emit when a child process errors out
 * * (event: 'unfinished-job', taskedChannelIdentifier: ITaskedChannelIdentifier) - Emit when a task cannot currently be completed by the child or the application for a non-error reason, and needs to be reassigned
 */
public static readonly jobStatusNotifier: JobStatusNotifier = new EventEmitter()

  /**
   * When this value is true, the app will stop accepting new jobs.
   * This value should not be changed directly.  Actually, I'm gonna make it a
   * getter so that it specifically can't be changed directly.  Instead, it should be changed
   * by emitting a 'die' event from the 'deathMonitor' event emitter
   */
public static appIsAwaitingDeath: boolean = false // This will set to true if deathMonitor emits the "die" event
```

## Methods

```typescript
  /**
   * This method is used to initiate a task in a child process.  It will automatically find the least busy child process and assign the job to them.
   * @param identifier An IChannelIdentifier containing the port/host information for the target job acceptor
   * @param task The name of the task to be requested
   */
  public initiateJobRequest(identifier: IChannelIdentifier, task: string)
```

## Usage

```typescript
import TCPJobInitiator, { JobStatusNotifier } from 'tcp-job-initiator'

class TCPJobInitiatorConsumer {
  constructor(private tcpJobInitiator: TCPJobInitiator | null) {
    this.deathMonitor = TCPJobInitiator.deathMonitor
    this.jobStatusNotifier = TCPJobInitiator.jobStatusNotifier
    // attach some event listeners
    this.jobStatusNotifier.on('task-complete', (taskData: ITaskData) => {
      // do something with the returned data
    })
    this.jobStatusNotifier.on('worker-error', (taskError: ITaskError) => {
      // do something with the error data
      console.log(taskError.error)
    })
    this.jobStatusNotifier.on('unfinished-job', (taskedChannelIdentifier: ITaskedChannelIdentifier) => {
      // probably going to want to restart this job, since it was stopped for a non-error reason
    })
  }
  private deathMonitor: EventEmitter = TCPJobInitiator.deathMonitor
  private jobStatusNotifier: JobStatusNotifier = TCPJobInitiator.jobStatusNotifier

/**
 * Begin a task using the identifier and task string.  If tcpJobInitiator is not currently set, 
 * create a new instance of TCPJobInitiator. 
 */
  public startTask(identifier: IChannelIdentifier, task: string) {
    if (this.tcpJobInitiator) {
      this.tcpJobInitiator.initiateJobRequest(identifier, task)
    } else {
      // If it was tcpJobInitiator was recently killed, revive it and start the task.
      this.tcpJobInitiator = new TCPJobInitiator()
      this.startTask(identifier, task)
    }
  }

/**
 * Kill the TCPJobInitiator, unset tcpJobInitiator so that the instance that was held there can be garbage
 * collected. 
 */
  public killJobInitiator() {
    this.tcpJobInitiator = null
    this.deathMonitor.emit("die")
  }
}
```
