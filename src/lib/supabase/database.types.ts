export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      activities: {
        Row: {
          bodyweight_kg: number | null;
          created_at: string;
          deleted_at: string | null;
          ended_at: string | null;
          id: string;
          local_date: string;
          notes: string | null;
          started_at: string | null;
          template_id: string | null;
          timezone: string;
          title: string | null;
          type: Database['public']['Enums']['activity_type'];
          updated_at: string;
          user_id: string;
          visibility: Database['public']['Enums']['visibility'];
        };
        ComputedFields: never;
        Insert: {
          bodyweight_kg?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          ended_at?: string | null;
          id?: string;
          local_date: string;
          notes?: string | null;
          started_at?: string | null;
          template_id?: string | null;
          timezone: string;
          title?: string | null;
          type: Database['public']['Enums']['activity_type'];
          updated_at?: string;
          user_id?: string;
          visibility?: Database['public']['Enums']['visibility'];
        };
        Update: {
          bodyweight_kg?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          ended_at?: string | null;
          id?: string;
          local_date?: string;
          notes?: string | null;
          started_at?: string | null;
          template_id?: string | null;
          timezone?: string;
          title?: string | null;
          type?: Database['public']['Enums']['activity_type'];
          updated_at?: string;
          user_id?: string;
          visibility?: Database['public']['Enums']['visibility'];
        };
        Relationships: [
          {
            foreignKeyName: 'activities_template_id_user_id_fkey';
            columns: ['template_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workout_templates';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      exercise_stats: {
        Row: {
          best_one_rep_max_kg: number | null;
          exercise_id: string;
          last_local_date: string | null;
          set_count: number;
          total_volume_kg: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          best_one_rep_max_kg?: number | null;
          exercise_id: string;
          last_local_date?: string | null;
          set_count?: number;
          total_volume_kg?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          best_one_rep_max_kg?: number | null;
          exercise_id?: string;
          last_local_date?: string | null;
          set_count?: number;
          total_volume_kg?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_stats_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      exercises: {
        Row: {
          adds_bodyweight: boolean;
          archived: boolean;
          created_at: string;
          deleted_at: string | null;
          equipment: Database['public']['Enums']['equipment'];
          id: string;
          muscle_group: Database['public']['Enums']['muscle_group'];
          name_en: string;
          name_pt: string;
          owner_id: string | null;
          slug: string | null;
          tracks_load: boolean;
          unit: Database['public']['Enums']['exercise_unit'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          adds_bodyweight?: boolean;
          archived?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          equipment: Database['public']['Enums']['equipment'];
          id?: string;
          muscle_group: Database['public']['Enums']['muscle_group'];
          name_en: string;
          name_pt: string;
          owner_id?: string | null;
          slug?: string | null;
          tracks_load?: boolean;
          unit?: Database['public']['Enums']['exercise_unit'];
          updated_at?: string;
        };
        Update: {
          adds_bodyweight?: boolean;
          archived?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          equipment?: Database['public']['Enums']['equipment'];
          id?: string;
          muscle_group?: Database['public']['Enums']['muscle_group'];
          name_en?: string;
          name_pt?: string;
          owner_id?: string | null;
          slug?: string | null;
          tracks_load?: boolean;
          unit?: Database['public']['Enums']['exercise_unit'];
          updated_at?: string;
        };
        Relationships: [];
      };
      gym_sets: {
        Row: {
          activity_id: string;
          created_at: string;
          deleted_at: string | null;
          duration_s: number | null;
          exercise_id: string;
          exercise_position: number;
          id: string;
          is_warmup: boolean;
          reps: number | null;
          rpe: number | null;
          set_number: number;
          updated_at: string;
          user_id: string;
          weight_kg: number | null;
        };
        ComputedFields: never;
        Insert: {
          activity_id: string;
          created_at?: string;
          deleted_at?: string | null;
          duration_s?: number | null;
          exercise_id: string;
          exercise_position: number;
          id?: string;
          is_warmup?: boolean;
          reps?: number | null;
          rpe?: number | null;
          set_number: number;
          updated_at?: string;
          user_id?: string;
          weight_kg?: number | null;
        };
        Update: {
          activity_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          duration_s?: number | null;
          exercise_id?: string;
          exercise_position?: number;
          id?: string;
          is_warmup?: boolean;
          reps?: number | null;
          rpe?: number | null;
          set_number?: number;
          updated_at?: string;
          user_id?: string;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'gym_sets_activity_id_user_id_fkey';
            columns: ['activity_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'activities';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'gym_sets_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      personal_records: {
        Row: {
          activity_id: string;
          created_at: string;
          distance: number | null;
          exercise_id: string | null;
          gym_set_id: string | null;
          id: string;
          local_date: string;
          pool_length: Database['public']['Enums']['pool_length'] | null;
          previous_value: number | null;
          sequence: number;
          stroke: Database['public']['Enums']['swim_stroke'] | null;
          swim_entry_id: string | null;
          swim_kind: Database['public']['Enums']['swim_kind'] | null;
          type: Database['public']['Enums']['activity_type'];
          user_id: string;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          activity_id: string;
          created_at?: string;
          distance?: number | null;
          exercise_id?: string | null;
          gym_set_id?: string | null;
          id?: string;
          local_date: string;
          pool_length?: Database['public']['Enums']['pool_length'] | null;
          previous_value?: number | null;
          sequence: number;
          stroke?: Database['public']['Enums']['swim_stroke'] | null;
          swim_entry_id?: string | null;
          swim_kind?: Database['public']['Enums']['swim_kind'] | null;
          type: Database['public']['Enums']['activity_type'];
          user_id: string;
          value: number;
        };
        Update: {
          activity_id?: string;
          created_at?: string;
          distance?: number | null;
          exercise_id?: string | null;
          gym_set_id?: string | null;
          id?: string;
          local_date?: string;
          pool_length?: Database['public']['Enums']['pool_length'] | null;
          previous_value?: number | null;
          sequence?: number;
          stroke?: Database['public']['Enums']['swim_stroke'] | null;
          swim_entry_id?: string | null;
          swim_kind?: Database['public']['Enums']['swim_kind'] | null;
          type?: Database['public']['Enums']['activity_type'];
          user_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'personal_records_activity_id_fkey';
            columns: ['activity_id'];
            isOneToOne: false;
            referencedRelation: 'activities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'personal_records_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'personal_records_gym_set_id_fkey';
            columns: ['gym_set_id'];
            isOneToOne: true;
            referencedRelation: 'gym_sets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'personal_records_swim_entry_id_fkey';
            columns: ['swim_entry_id'];
            isOneToOne: true;
            referencedRelation: 'swim_entries';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          bodyweight_kg: number | null;
          created_at: string;
          default_pool_length: Database['public']['Enums']['pool_length'] | null;
          display_name: string | null;
          gym_focus: Database['public']['Enums']['gym_focus'] | null;
          id: string;
          locale: string;
          onboarded_at: string | null;
          pool_unit: Database['public']['Enums']['pool_unit'];
          sports: Database['public']['Enums']['activity_type'][] | null;
          swim_style: Database['public']['Enums']['swim_style'] | null;
          timezone: string;
          updated_at: string;
          visibility: Database['public']['Enums']['visibility'];
          weekly_target: number | null;
          weight_unit: Database['public']['Enums']['weight_unit'];
        };
        ComputedFields: never;
        Insert: {
          bodyweight_kg?: number | null;
          created_at?: string;
          default_pool_length?: Database['public']['Enums']['pool_length'] | null;
          display_name?: string | null;
          gym_focus?: Database['public']['Enums']['gym_focus'] | null;
          id: string;
          locale?: string;
          onboarded_at?: string | null;
          pool_unit?: Database['public']['Enums']['pool_unit'];
          sports?: Database['public']['Enums']['activity_type'][] | null;
          swim_style?: Database['public']['Enums']['swim_style'] | null;
          timezone?: string;
          updated_at?: string;
          visibility?: Database['public']['Enums']['visibility'];
          weekly_target?: number | null;
          weight_unit?: Database['public']['Enums']['weight_unit'];
        };
        Update: {
          bodyweight_kg?: number | null;
          created_at?: string;
          default_pool_length?: Database['public']['Enums']['pool_length'] | null;
          display_name?: string | null;
          gym_focus?: Database['public']['Enums']['gym_focus'] | null;
          id?: string;
          locale?: string;
          onboarded_at?: string | null;
          pool_unit?: Database['public']['Enums']['pool_unit'];
          sports?: Database['public']['Enums']['activity_type'][] | null;
          swim_style?: Database['public']['Enums']['swim_style'] | null;
          timezone?: string;
          updated_at?: string;
          visibility?: Database['public']['Enums']['visibility'];
          weekly_target?: number | null;
          weight_unit?: Database['public']['Enums']['weight_unit'];
        };
        Relationships: [];
      };
      swim_entries: {
        Row: {
          activity_id: string;
          created_at: string;
          deleted_at: string | null;
          distance: number;
          id: string;
          kind: Database['public']['Enums']['swim_kind'];
          pool_length: Database['public']['Enums']['pool_length'];
          position: number;
          splits_cs: number[] | null;
          stroke: Database['public']['Enums']['swim_stroke'];
          time_cs: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          activity_id: string;
          created_at?: string;
          deleted_at?: string | null;
          distance: number;
          id?: string;
          kind: Database['public']['Enums']['swim_kind'];
          pool_length: Database['public']['Enums']['pool_length'];
          position?: number;
          splits_cs?: number[] | null;
          stroke: Database['public']['Enums']['swim_stroke'];
          time_cs: number;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          activity_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          distance?: number;
          id?: string;
          kind?: Database['public']['Enums']['swim_kind'];
          pool_length?: Database['public']['Enums']['pool_length'];
          position?: number;
          splits_cs?: number[] | null;
          stroke?: Database['public']['Enums']['swim_stroke'];
          time_cs?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'swim_entries_activity_id_user_id_fkey';
            columns: ['activity_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'activities';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      workout_template_exercises: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          exercise_id: string;
          id: string;
          notes: string | null;
          position: number;
          target_reps_max: number | null;
          target_reps_min: number | null;
          target_seconds: number | null;
          target_sets: number | null;
          template_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          exercise_id: string;
          id?: string;
          notes?: string | null;
          position: number;
          target_reps_max?: number | null;
          target_reps_min?: number | null;
          target_seconds?: number | null;
          target_sets?: number | null;
          template_id: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          exercise_id?: string;
          id?: string;
          notes?: string | null;
          position?: number;
          target_reps_max?: number | null;
          target_reps_min?: number | null;
          target_seconds?: number | null;
          target_sets?: number | null;
          template_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_template_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_template_exercises_template_id_user_id_fkey';
            columns: ['template_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workout_templates';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      workout_templates: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          name: string;
          notes: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      current_records: {
        Row: {
          activity_id: string;
          distance: number | null;
          exercise_id: string | null;
          gym_set_id: string | null;
          id: string;
          local_date: string;
          pool_length: Database['public']['Enums']['pool_length'] | null;
          previous_value: number | null;
          sequence: number;
          stroke: Database['public']['Enums']['swim_stroke'] | null;
          swim_entry_id: string | null;
          swim_kind: Database['public']['Enums']['swim_kind'] | null;
          type: Database['public']['Enums']['activity_type'];
          user_id: string;
          value: number;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'personal_records_activity_id_fkey';
            columns: ['activity_id'];
            isOneToOne: false;
            referencedRelation: 'activities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'personal_records_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'personal_records_gym_set_id_fkey';
            columns: ['gym_set_id'];
            isOneToOne: true;
            referencedRelation: 'gym_sets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'personal_records_swim_entry_id_fkey';
            columns: ['swim_entry_id'];
            isOneToOne: true;
            referencedRelation: 'swim_entries';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      delete_activity: { Args: { p_activity_id: string }; Returns: undefined };
      delete_custom_exercise: { Args: { p_exercise_id: string }; Returns: undefined };
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      save_workout_template: { Args: { p_template: Json }; Returns: undefined };
    };
    Enums: {
      activity_type: 'gym' | 'swim';
      equipment:
        | 'barbell'
        | 'dumbbell'
        | 'kettlebell'
        | 'machine'
        | 'cable'
        | 'smith_machine'
        | 'ez_bar'
        | 'bodyweight'
        | 'band'
        | 'other';
      exercise_unit: 'reps' | 'seconds';
      gym_focus: 'strength' | 'hypertrophy' | 'maintenance';
      muscle_group:
        | 'chest'
        | 'back'
        | 'shoulders'
        | 'biceps'
        | 'triceps'
        | 'forearms'
        | 'core'
        | 'quads'
        | 'hamstrings'
        | 'glutes'
        | 'calves'
        | 'full_body';
      pool_length: '25m' | '50m' | '25yd';
      pool_unit: 'm' | 'yd';
      swim_kind: 'race' | 'training';
      swim_stroke: 'free' | 'back' | 'breast' | 'fly' | 'im';
      swim_style: 'competitive' | 'fitness';
      visibility: 'private' | 'followers' | 'public';
      weight_unit: 'kg' | 'lb';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_type: ['gym', 'swim'],
      equipment: [
        'barbell',
        'dumbbell',
        'kettlebell',
        'machine',
        'cable',
        'smith_machine',
        'ez_bar',
        'bodyweight',
        'band',
        'other',
      ],
      exercise_unit: ['reps', 'seconds'],
      gym_focus: ['strength', 'hypertrophy', 'maintenance'],
      muscle_group: [
        'chest',
        'back',
        'shoulders',
        'biceps',
        'triceps',
        'forearms',
        'core',
        'quads',
        'hamstrings',
        'glutes',
        'calves',
        'full_body',
      ],
      pool_length: ['25m', '50m', '25yd'],
      pool_unit: ['m', 'yd'],
      swim_kind: ['race', 'training'],
      swim_stroke: ['free', 'back', 'breast', 'fly', 'im'],
      swim_style: ['competitive', 'fitness'],
      visibility: ['private', 'followers', 'public'],
      weight_unit: ['kg', 'lb'],
    },
  },
} as const;
