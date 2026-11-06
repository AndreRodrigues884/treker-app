import { useLocalSearchParams } from 'expo-router';

import { CustomExerciseForm } from '@/features/exercises/custom-exercise-form';

// A new custom exercise. ?name= starts it with what the athlete searched for; ?pick=<template id>
// ticks it in the library's multiple choice once saved.
export default function NewExerciseScreen() {
  const { name, pick } = useLocalSearchParams<{ name?: string; pick?: string }>();
  return <CustomExerciseForm initialName={name} pickSession={pick} />;
}
