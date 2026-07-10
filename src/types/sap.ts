export interface SAPLoginResponse {
  SessionId: string;
  Version: string;
  SessionTimeout: number;
}

export interface SAPServiceCall {
  ServiceCallID: number; // SAP ic kimlik (routing icin)
  DocNum: number; // Kullaniciya gosterilen belge numarasi
  Subject: string;
  CustomerCode: string;
  CustomerName: string;
  ItemCode: string;
  ItemDescription: string;
  InternalSerialNum: string;
  TechnicianCode: number;
  Status: SAPServiceCallStatus;
  CallType: number;
  ProblemType: string;
  ProblemSubType: string;
  Priority: SAPPriority;
  Origin: string;
  Description: string;
  Resolution: string;
  CreateDate: string;
  CreateTime: string;
  CloseDate: string;
  AssigneeCode: number;
  U_ImzaEkiNo?: number;
  U_GarantiKrediNotuNo?: number;
  U_YolMesafe?: number;
  U_YolUcreti?: number;
  U_MusteriPuani?: number;
  ServiceCallActivities: SAPServiceCallActivity[];
  ServiceCallInventoryExpenses: SAPServiceCallExpense[];
  ServiceCallSolutions: SAPServiceCallSolution[];
}

export enum SAPServiceCallStatus {
  OPEN = -3,
  PENDING = -2,
  CLOSED = -1,
}

export type SAPPriority = 'scp_Low' | 'scp_Medium' | 'scp_High';

export interface SAPServiceCallActivity {
  ActivityCode: number;
  TechnicianCode: number;
  ActivityDate: string;
  StartTime: string;
  EndTime: string;
  Notes: string;
}

export interface SAPServiceCallExpense {
  ItemCode: string;
  ItemDescription: string;
  Quantity: number;
  UnitPrice: number;
  LineTotal: number;
}

export interface SAPServiceCallSolution {
  SolutionCode: number;
  Description: string;
}

export interface SAPBusinessPartner {
  CardCode: string;
  CardName: string;
  CardType: string;
  Phone1: string;
  Phone2: string;
  EmailAddress: string;
  Address: string;
  City: string;
  Country: string;
}

export interface SAPItem {
  ItemCode: string;
  ItemName: string;
  ItemType: string;
  QuantityOnStock: number;
  QuantityOrderedByCustomers: number;
  BarCode: string;
  ItemWarehouseInfoCollection: SAPItemWarehouse[];
}

export interface SAPItemWarehouse {
  WarehouseCode: string;
  InStock: number;
  Committed: number;
  Ordered: number;
  BinLocations?: SAPBinLocation[];
}

export interface SAPBinLocation {
  BinCode: string;
  BinAbsEntry: number;
  Quantity: number;
}

export interface SAPWarehouse {
  WarehouseCode: string;
  WarehouseName: string;
  City: string;
  Country: string;
}

export interface SAPEmployee {
  EmployeeID: number;
  FirstName: string;
  LastName: string;
  Department: string;
  Position: string;
  MobilePhone: string;
  eMail: string;
  ApplicationUserID?: number | null; // dolu ise calisan ayni zamanda SAP kullanicisi
  U_BolgeKodu?: string;
}

// SAP B1 CustomerEquipmentCard (OINS) - musterinin ekipman/seri kartlari
export interface SAPCustomerEquipment {
  EquipmentCardNum: number;
  ItemCode: string;
  ItemDescription: string;
  InternalSerialNum: string | null;
  ManufacturerSerialNum: string | null;
  StatusOfSerialNumber: string;
}

// SAP B1 Activity (OCLG) - servis aktiviteleri (is baslangic/bitis kayitlari)
export interface SAPActivity {
  ActivityCode: number;
  CardCode: string;
  Notes: string;
  ActivityDate: string;
  ActivityTime: string;
  StartDate: string;
  StartTime: string;
  EndDueDate: string;
  EndTime: string;
  Duration: number;
  DurationType: string;
  Activity: string; // cn_Conversation | cn_Meeting | cn_Task | cn_Note | cn_Other
  Details: string;
  HandledBy?: number | null; // SAP kullanici InternalKey'i (kullaniciysa)
  HandledByEmployee: number; // calisan EmployeeID (kullanicisi yoksa)
  ParentObjectId: string; // Bagli ServiceCall ID
  ParentObjectType: string; // '191' = ServiceCall
  U_Km?: number; // Yol mesafesi (UDF - SAP'de tanimlanmali)
}

export interface SAPODataResponse<T> {
  'odata.metadata': string;
  value: T[];
  'odata.nextLink'?: string;
}

export interface SAPAttachmentResponse {
  AbsoluteEntry: number;
}
