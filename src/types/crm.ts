// CRM-specific types

export interface LeadSource {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
}

export interface CustomField {
  id: string;
  entity_type: string;
  field_name: string;
  field_label: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options: string[] | null;
  is_required: boolean;
  order_index: number;
  is_active: boolean;
  created_at: string;
}

export interface LeadCustomValue {
  id: string;
  lead_id: string;
  field_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_boolean: boolean | null;
  created_at: string;
  updated_at: string;
  field?: CustomField;
}

export interface CSVImport {
  id: string;
  file_name: string;
  total_rows: number;
  imported_rows: number;
  failed_rows: number;
  status: 'processing' | 'completed' | 'failed';
  error_log: Record<string, unknown>[] | null;
  imported_by: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ExtendedLead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  guardian_name: string | null;
  source: string;
  source_id: string | null;
  campaign: string | null;
  ad_set: string | null;
  ad_name: string | null;
  status: string;
  course_interest_id: string | null;
  assigned_agent_id: string | null;
  assigned_producer_id: string | null;
  notes: string | null;
  scheduled_at: string | null;
  attended_at: string | null;
  proposal_at: string | null;
  enrolled_at: string | null;
  lost_at: string | null;
  external_id: string | null;
  external_source: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  lead_source?: LeadSource | null;
  course?: { name: string } | null;
  agent?: { full_name: string } | null;
  custom_values?: LeadCustomValue[];
}

export type CRMViewMode = 'list' | 'kanban' | 'pipeline';

export interface CSVColumnMapping {
  csvColumn: string;
  systemField: string | null;
}
