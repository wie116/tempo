export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "app_daily_activity": {
                  Row: {
                    "activity_date": string,"first_seen_at": string,"last_seen_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_date": string,"first_seen_at"?: string,"last_seen_at"?: string,"user_id": string
                  }
                  Update: {
                    "activity_date"?: string,"first_seen_at"?: string,"last_seen_at"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"app_user_metrics": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"blocks": {
                  Row: {
                    "closed_at": number | null,"color": string,"deleted_at": string | null,"duration_min": number,"external_ref": Json | null,"icon": string | null,"id": string,"kind": string,"notes": string,"pinned": boolean,"repeat": string,"repeat_until": string | null,"repeat_weekdays": (number)[] | null,"revision": number,"series_id": string | null,"source": string,"starts_at": string,"status": string,"sync_status": string,"task_id": string | null,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: number | null,"color"?: string,"deleted_at"?: string | null,"duration_min": number,"external_ref"?: Json | null,"icon"?: string | null,"id": string,"kind"?: string,"notes"?: string,"pinned"?: boolean,"repeat"?: string,"repeat_until"?: string | null,"repeat_weekdays"?: (number)[] | null,"revision"?: number,"series_id"?: string | null,"source"?: string,"starts_at": string,"status"?: string,"sync_status"?: string,"task_id"?: string | null,"title": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "closed_at"?: number | null,"color"?: string,"deleted_at"?: string | null,"duration_min"?: number,"external_ref"?: Json | null,"icon"?: string | null,"id"?: string,"kind"?: string,"notes"?: string,"pinned"?: boolean,"repeat"?: string,"repeat_until"?: string | null,"repeat_weekdays"?: (number)[] | null,"revision"?: number,"series_id"?: string | null,"source"?: string,"starts_at"?: string,"status"?: string,"sync_status"?: string,"task_id"?: string | null,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"calendar_connections": {
                  Row: {
                    "created_at": string,"email": string,"encrypted_refresh_token": string,"id": string,"provider": string,"selected_calendar_ids": (string)[],"token_iv": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string,"encrypted_refresh_token": string,"id"?: string,"provider"?: string,"selected_calendar_ids"?: (string)[],"token_iv": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"encrypted_refresh_token"?: string,"id"?: string,"provider"?: string,"selected_calendar_ids"?: (string)[],"token_iv"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"calendar_oauth_states": {
                  Row: {
                    "code_verifier": string,"created_at": string,"expires_at": string,"return_to": string,"state_hash": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code_verifier": string,"created_at"?: string,"expires_at": string,"return_to": string,"state_hash": string,"user_id": string
                  }
                  Update: {
                    "code_verifier"?: string,"created_at"?: string,"expires_at"?: string,"return_to"?: string,"state_hash"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"calendar_sync_state": {
                  Row: {
                    "calendar_id": string,"connection_id": string,"last_synced_at": string | null,"sync_token": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "calendar_id": string,"connection_id": string,"last_synced_at"?: string | null,"sync_token"?: string | null
                  }
                  Update: {
                    "calendar_id"?: string,"connection_id"?: string,"last_synced_at"?: string | null,"sync_token"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "calendar_sync_state_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "calendar_connections"
      referencedColumns: ["id"]
    }
                  ]
                },"lists": {
                  Row: {
                    "collapsed": boolean,"color": string,"deleted_at": string | null,"id": string,"name": string,"revision": number,"scope": string,"sort_order": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "collapsed"?: boolean,"color"?: string,"deleted_at"?: string | null,"id": string,"name": string,"revision"?: number,"scope"?: string,"sort_order"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "collapsed"?: boolean,"color"?: string,"deleted_at"?: string | null,"id"?: string,"name"?: string,"revision"?: number,"scope"?: string,"sort_order"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"profiles": {
                  Row: {
                    "deleted_at": string | null,"id": string,"revision": number,"settings": NonNullable<Json>,"settings_version": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "deleted_at"?: string | null,"id": string,"revision"?: number,"settings"?: NonNullable<Json>,"settings_version"?: number,"updated_at"?: string
                  }
                  Update: {
                    "deleted_at"?: string | null,"id"?: string,"revision"?: number,"settings"?: NonNullable<Json>,"settings_version"?: number,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"tasks": {
                  Row: {
                    "archived_at": string | null,"color": string | null,"completed_at": string | null,"deleted_at": string | null,"due_date": string | null,"estimated_min": number | null,"id": string,"is_archived": boolean,"is_inbox": boolean,"is_recurring": boolean,"list_id": string | null,"notes": string,"planned_date": string | null,"priority": string,"repeat": string,"repeat_until": string | null,"repeat_weekdays": (number)[] | null,"revision": number,"sort_order": number,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"color"?: string | null,"completed_at"?: string | null,"deleted_at"?: string | null,"due_date"?: string | null,"estimated_min"?: number | null,"id": string,"is_archived"?: boolean,"is_inbox"?: boolean,"is_recurring"?: boolean,"list_id"?: string | null,"notes"?: string,"planned_date"?: string | null,"priority"?: string,"repeat"?: string,"repeat_until"?: string | null,"repeat_weekdays"?: (number)[] | null,"revision"?: number,"sort_order"?: number,"title": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"color"?: string | null,"completed_at"?: string | null,"deleted_at"?: string | null,"due_date"?: string | null,"estimated_min"?: number | null,"id"?: string,"is_archived"?: boolean,"is_inbox"?: boolean,"is_recurring"?: boolean,"list_id"?: string | null,"notes"?: string,"planned_date"?: string | null,"priority"?: string,"repeat"?: string,"repeat_until"?: string | null,"repeat_weekdays"?: (number)[] | null,"revision"?: number,"sort_order"?: number,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_list_id_fkey"
      columns: ["list_id"]
isOneToOne: false
      referencedRelation: "lists"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_dashboard_metrics":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"touch_app_activity":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {

          }
        }
} as cons
