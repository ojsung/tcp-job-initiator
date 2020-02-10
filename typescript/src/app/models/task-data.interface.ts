import { ITaskedChannelIdentifier } from './channel-identifier.interface'
import { ITCPDataResponse } from './tcp-data-response.interface'

export interface ITaskData {
  taskedIdentifier: ITaskedChannelIdentifier
  data: ITCPDataResponse
}
