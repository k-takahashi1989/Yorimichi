import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ViewToken,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/memoStore';
import { initPermissions } from '../services/permissionService';
import { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Page {
  key: string;
  icon: string;
  titleKey: string;
  descKey: string;
  color: string;
}

const PAGES: Page[] = [
  { key: '1', icon: 'notifications-active', titleKey: 'onboarding.page1Title', descKey: 'onboarding.page1Desc', color: '#4CAF50' },
  { key: '2', icon: 'touch-app', titleKey: 'onboarding.page2Title', descKey: 'onboarding.page2Desc', color: '#2196F3' },
  { key: '3', icon: 'star', titleKey: 'onboarding.page3Title', descKey: 'onboarding.page3Desc', color: '#FF9800' },
];

export default function OnboardingScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const markTutorialSeen = useSettingsStore(s => s.markTutorialSeen);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleComplete = useCallback(() => {
    markTutorialSeen('onboarding');
    navigation.replace('MainTabs');
    // オンボーディング完了後に位置情報・通知の権限をリクエスト
    initPermissions();
  }, [markTutorialSeen, navigation]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderPage = ({ item }: { item: Page }) => (
    <View style={[styles.page, { width: SCREEN_WIDTH }]}>
      <View style={[styles.iconCircle, { backgroundColor: item.color + '20' }]}>
        <Icon name={item.icon} size={64} color={item.color} />
      </View>
      <Text style={styles.pageTitle}>{t(item.titleKey)}</Text>
      <Text style={styles.pageDesc}>{t(item.descKey)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Skip button */}
      <TouchableOpacity style={styles.skipBtn} onPress={handleComplete}>
        <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={PAGES}
        renderItem={renderPage}
        keyExtractor={item => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />

      {/* Dot indicators */}
      <View style={styles.dotsRow}>
        {PAGES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === currentIndex && styles.dotActive]}
          />
        ))}
      </View>

      {/* Start button on last page */}
      {currentIndex === PAGES.length - 1 ? (
        <TouchableOpacity style={styles.startBtn} onPress={handleComplete}>
          <Text style={styles.startBtnText}>{t('onboarding.start')}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.startBtnPlaceholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  skipBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    fontSize: 15,
    color: '#9E9E9E',
    fontWeight: '600',
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 16,
  },
  pageDesc: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  dotActive: {
    backgroundColor: '#4CAF50',
    width: 24,
    borderRadius: 4,
  },
  startBtn: {
    marginHorizontal: 40,
    marginBottom: 50,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  startBtnPlaceholder: {
    height: 82,
    marginBottom: 50,
  },
});
