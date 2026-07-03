import { TableStatus } from '../enums';

export interface Floor {
  id: number;
  name: string;
}

export interface Table {
  id: number;
  floorId: number;
  name: string;
  capacity: number;
  posX: number;
  posY: number;
  shape: string;
  status: TableStatus;
  isPinned?: boolean;
}

export interface CreateTableDTO {
  floorId: number;
  name: string;
  capacity: number;
  posX: number;
  posY: number;
  shape: string;
}

export interface UpdateTableDTO {
  id: number;
  floorId?: number;
  name?: string;
  capacity?: number;
  posX?: number;
  posY?: number;
  shape?: string;
  status?: TableStatus;
}
