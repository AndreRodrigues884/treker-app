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
      profiles: {
        Row: {
          bodyweight_kg: number | null;
          created_at: string;
          display_name: string | null;
          id: string;
          locale: string;
          pool_unit: Database['public']['Enums']['pool_unit'];
          timezone: string;
          updated_at: string;
          visibility: Database['public']['Enums']['visibility'];
          weight_unit: Database['public']['Enums']['weight_unit'];
        };
        ComputedFields: never;
        Insert: {
          bodyweight_kg?: number | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          locale?: string;
          pool_unit?: Database['public']['Enums']['pool_unit'];
          timezone?: string;
          updated_at?: string;
          visibility?: Database['public']['Enums']['visibility'];
          weight_unit?: Database['public']['Enums']['weight_unit'];
        };
        Update: {
          bodyweight_kg?: number | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          locale?: string;
          pool_unit?: Database['public']['Enums']['pool_unit'];
          timezone?: string;
          updated_at?: string;
          visibility?: Database['public']['Enums']['visibility'];
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
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
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
      visibility: ['private', 'followers', 'public'],
      weight_unit: ['kg', 'lb'],
    },
  },
} as const;
