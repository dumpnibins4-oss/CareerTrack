import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Alert, BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate,
  FadeIn, FadeOut,
} from 'react-native-reanimated';
import CustomSlider from '../components/CustomSlider';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../constants/design';
import RobotMascot from '../components/RobotMascot';
import { ALL_RIASEC_QUESTIONS, LIKERT_OPTIONS } from '../data/questions';
import { runFIS, computeRIASECScore } from '../fuzzy/fis';
import {
  Grades, RIASECKey, RIASECScores, AptitudeRatings,
  RIASECAnswers, FISResult,
} from '../types';

// ─── Step configuration ───────────────────────────────────────────────────────
// Steps: 3 grade sliders + 24 RIASEC + 3 aptitude = 30 total
const TOTAL_STEPS = 30;
const GRADE_STEPS = 3;
const RIASEC_STEPS = 24;
const APTITUDE_STEPS = 3;

type GradeField = 'math' | 'science' | 'english';
const GRADE_QUESTIONS: { field: GradeField; question: string }[] = [
  { field: 'math',    question: "What's your average grade in Mathematics?" },
  { field: 'science', question: 'And in Science?' },
  { field: 'english', question: 'How about English?' },
];

type AptitudeField = 'logical' | 'spatial' | 'linguistic';
const APTITUDE_QUESTIONS: { field: AptitudeField; question: string }[] = [
  { field: 'logical',    question: 'How would you rate your Logical Reasoning?' },
  { field: 'spatial',    question: 'How about your Spatial Awareness?' },
  { field: 'linguistic', question: 'And your Linguistic Skill?' },
];

const APTITUDE_CARD_OPTIONS = [
  { label: 'Low',       value: 25 },
  { label: 'Medium',    value: 50 },
  { label: 'High',      value: 75 },
  { label: 'Very High', value: 100 },
];

function gradeLabel(g: number): string {
  if (g < 70) return 'NEEDS IMPROVEMENT';
  if (g < 80) return 'SATISFACTORY';
  if (g < 87) return 'GOOD';
  if (g < 95) return 'VERY GOOD';
  return 'EXCELLENT';
}

// ─── Main Assessment Screen ───────────────────────────────────────────────────
export default function AssessmentScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0..29

  // Grades
  const [grades, setGrades] = useState<Grades>({ math: 80, science: 80, english: 80 });

  // RIASEC raw answers [dim][q_idx] = 1..5
  const [riasecAnswers, setRiasecAnswers] = useState<RIASECAnswers>({
    realistic: [], investigative: [], artistic: [],
    social: [], enterprising: [], conventional: [],
  });

  // Aptitude
  const [aptitude, setAptitude] = useState<AptitudeRatings>({ logical: 0, spatial: 0, linguistic: 0 });

  // Current RIASEC selection
  const [selectedLikert, setSelectedLikert] = useState<number | null>(null);

  // Progress bar
  const progress = useSharedValue(0);
  React.useEffect(() => {
    progress.value = withTiming((step + 1) / TOTAL_STEPS, { duration: 350 });
  }, [step]);
  const barStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0, 1], [0, 100])}%`,
  }));

  // Back button handling
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (step > 0) { goBack(); return true; }
        return false;
      });
      return () => sub.remove();
    }, [step])
  );

  function goBack() {
    if (step === 0) { router.back(); return; }
    // Reset RIASEC selection when going back to a RIASEC step
    const prevStep = step - 1;
    if (prevStep >= GRADE_STEPS && prevStep < GRADE_STEPS + RIASEC_STEPS) {
      const qInfo = ALL_RIASEC_QUESTIONS[prevStep - GRADE_STEPS];
      const dimAnswers = riasecAnswers[qInfo.dimension];
      setSelectedLikert(dimAnswers[qInfo.index] ?? null);
    } else {
      setSelectedLikert(null);
    }
    setStep(prevStep);
  }

  function goNext() {
    if (step < TOTAL_STEPS - 1) {
      setSelectedLikert(null);
      setStep(step + 1);
    } else {
      finishAssessment();
    }
  }

  function handleExitConfirm() {
    Alert.alert(
      'Exit Assessment',
      'Are you sure? Your progress will be lost.',
      [
        { text: 'Keep Going', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => router.back() },
      ]
    );
  }

  function finishAssessment() {
    // Compute RIASEC scores
    const riasecScores: RIASECScores = {
      realistic:    computeRIASECScore(riasecAnswers.realistic),
      investigative: computeRIASECScore(riasecAnswers.investigative),
      artistic:     computeRIASECScore(riasecAnswers.artistic),
      social:       computeRIASECScore(riasecAnswers.social),
      enterprising: computeRIASECScore(riasecAnswers.enterprising),
      conventional: computeRIASECScore(riasecAnswers.conventional),
    };

    const results: FISResult[] = runFIS({ grades, riasecScores, aptitude });

    router.push({
      pathname: '/results',
      params: {
        results: JSON.stringify(results),
        grades: JSON.stringify(grades),
        riasecScores: JSON.stringify(riasecScores),
        aptitude: JSON.stringify(aptitude),
      },
    });
  }

  // ─── Render current step ──────────────────────────────────────────────────
  function renderStep() {
    // GRADE STEPS (0, 1, 2)
    if (step < GRADE_STEPS) {
      const { field, question } = GRADE_QUESTIONS[step];
      const value = grades[field];
      return (
        <GradeSliderStep
          question={question}
          value={value}
          onChange={(v) => setGrades((g) => ({ ...g, [field]: v }))}
          onNext={goNext}
        />
      );
    }

    // RIASEC STEPS (3..26)
    if (step < GRADE_STEPS + RIASEC_STEPS) {
      const qIdx = step - GRADE_STEPS;
      const qInfo = ALL_RIASEC_QUESTIONS[qIdx];
      const saved = riasecAnswers[qInfo.dimension][qInfo.index] ?? null;
      const current = selectedLikert ?? saved;

      return (
        <LikertStep
          question={qInfo.text}
          selected={current}
          onSelect={(v) => setSelectedLikert(v)}
          onNext={() => {
            if (current == null) return;
            // Save answer
            setRiasecAnswers((prev) => {
              const dim = [...prev[qInfo.dimension]];
              dim[qInfo.index] = current;
              return { ...prev, [qInfo.dimension]: dim };
            });
            goNext();
          }}
          canContinue={current !== null}
          dimensionLabel={qInfo.dimension.charAt(0).toUpperCase() + qInfo.dimension.slice(1)}
          questionNum={qIdx + 1}
        />
      );
    }

    // APTITUDE STEPS (27..29)
    const aptIdx = step - GRADE_STEPS - RIASEC_STEPS;
    const { field: aptField, question: aptQ } = APTITUDE_QUESTIONS[aptIdx];
    return (
      <AptitudeStep
        question={aptQ}
        selected={aptitude[aptField] || null}
        onSelect={(v) => setAptitude((a) => ({ ...a, [aptField]: v }))}
        onNext={() => {
          if (!aptitude[aptField]) return;
          goNext();
        }}
        canContinue={aptitude[aptField] > 0}
      />
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={goBack} style={styles.topBarBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.topBarBtnText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, barStyle]} />
        </View>

        <TouchableOpacity onPress={handleExitConfirm} style={styles.topBarBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.topBarBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.stepCounter}>{step + 1} / {TOTAL_STEPS}</Text>

      <Animated.View
        key={step}
        entering={FadeIn.duration(220)}
        exiting={FadeOut.duration(150)}
        style={{ flex: 1 }}
      >
        {renderStep()}
      </Animated.View>
    </View>
  );
}

// ─── Grade Slider Step ────────────────────────────────────────────────────────
function GradeSliderStep({
  question, value, onChange, onNext,
}: {
  question: string; value: number;
  onChange: (v: number) => void; onNext: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.stepContainer}>
      <RobotMascot size={64} />
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>{question}</Text>
      </View>

      <View style={styles.gradeDisplay}>
        <Text style={styles.gradeNumber}>{value}</Text>
        <Text style={styles.gradeLabel}>{gradeLabel(value)}</Text>
      </View>

      <CustomSlider
        style={styles.slider}
        minimumValue={60}
        maximumValue={100}
        step={1}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={COLORS.primary}
        maximumTrackTintColor={COLORS.border}
        thumbTintColor={COLORS.primary}
      />

      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabelText}>60</Text>
        <Text style={styles.sliderLabelText}>100</Text>
      </View>

      <TouchableOpacity style={styles.continueBtn} onPress={onNext} activeOpacity={0.85}>
        <Text style={styles.continueBtnText}>Continue ›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Likert Step ──────────────────────────────────────────────────────────────
function LikertStep({
  question, selected, onSelect, onNext, canContinue, dimensionLabel, questionNum,
}: {
  question: string; selected: number | null;
  onSelect: (v: number) => void; onNext: () => void;
  canContinue: boolean; dimensionLabel: string; questionNum: number;
}) {
  return (
    <ScrollView contentContainerStyle={styles.stepContainer}>
      <View style={styles.dimBadge}>
        <Text style={styles.dimBadgeText}>{dimensionLabel} · Q{questionNum}</Text>
      </View>
      <RobotMascot size={56} />
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>{question}</Text>
      </View>

      <View style={styles.optionsList}>
        {LIKERT_OPTIONS.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionCard, isSelected && styles.optionCardSelected]}
              onPress={() => onSelect(opt.value)}
              activeOpacity={0.8}
            >
              <Text style={styles.optionEmoji}>{opt.emoji}</Text>
              <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                {opt.label}
              </Text>
              {isSelected && (
                <View style={styles.checkCircle}>
                  <Text style={styles.checkCircleText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
        onPress={onNext}
        disabled={!canContinue}
        activeOpacity={0.85}
      >
        <Text style={styles.continueBtnText}>Continue ›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Aptitude Step ────────────────────────────────────────────────────────────
function AptitudeStep({
  question, selected, onSelect, onNext, canContinue,
}: {
  question: string; selected: number | null;
  onSelect: (v: number) => void; onNext: () => void; canContinue: boolean;
}) {
  return (
    <ScrollView contentContainerStyle={styles.stepContainer}>
      <RobotMascot size={56} />
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>{question}</Text>
      </View>

      <View style={styles.optionsList}>
        {APTITUDE_CARD_OPTIONS.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionCard, isSelected && styles.optionCardSelected]}
              onPress={() => onSelect(opt.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                {opt.label}
              </Text>
              {isSelected && (
                <View style={styles.checkCircle}>
                  <Text style={styles.checkCircleText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
        onPress={onNext}
        disabled={!canContinue}
        activeOpacity={0.85}
      >
        <Text style={styles.continueBtnText}>Continue ›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: 52,
    paddingBottom: SPACING.sm,
    gap: SPACING.md,
    backgroundColor: COLORS.white,
  },
  topBarBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarBtnText: { fontSize: FONT_SIZE.xl, color: COLORS.text, lineHeight: 28 },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
  stepCounter: {
    textAlign: 'center',
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
    fontWeight: '600',
  },
  stepContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 40,
  },
  bubble: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    borderTopLeftRadius: 4,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  bubbleText: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
    fontWeight: '600',
    lineHeight: 26,
  },
  gradeDisplay: {
    alignItems: 'center',
    marginVertical: SPACING.xl,
  },
  gradeNumber: {
    fontSize: 72,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: -2,
  },
  gradeLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  slider: {
    width: '100%',
    height: 44,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
    marginBottom: SPACING.xl,
  },
  sliderLabelText: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontWeight: '600' },
  dimBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: SPACING.md,
  },
  dimBadgeText: { fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: '700' },
  optionsList: { gap: SPACING.sm, marginBottom: SPACING.lg },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
  },
  optionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  optionEmoji: { fontSize: 22, width: 28, textAlign: 'center' },
  optionLabel: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  optionLabelSelected: { color: COLORS.primary, fontWeight: '700' },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleText: { color: COLORS.white, fontSize: FONT_SIZE.sm, fontWeight: '700' },
  continueBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  continueBtnDisabled: { backgroundColor: COLORS.border },
  continueBtnText: { color: COLORS.white, fontSize: FONT_SIZE.lg, fontWeight: '700' },
});
