export interface Role {
  id: number;
  name: string;
  permissions: string[];
}

export interface Staff {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  pinHash: string;
  roleId: number;
  isActive: boolean;
  hourlyRate: number;
  role?: Role;
}

export interface Attendance {
  id: number;
  staffId: number;
  clockIn: string;
  clockOut?: string;
  date: string;
}

export interface StaffLoginDTO {
  pin: string;
}

export interface CreateStaffDTO {
  name: string;
  phone?: string;
  email?: string;
  pin: string;
  roleId: number;
  isActive?: boolean;
  hourlyRate: number;
}
