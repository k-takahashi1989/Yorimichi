import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, LongPressEvent, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import Slider from '@react-native-community/slider';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import Config from 'react-native-config';
import { useMemoStore } from '../store/memoStore';
import { useSettingsStore } from '../store/memoStore';
import { useShallow } from 'zustand/react/shallow';
import { RootStackParamList, RecentPlace } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'LocationPicker'>;

interface PickedLocation {
  latitude: number;
  longitude: number;
}

// フォールバック（現在地が取得できない場合）
const FALLBACK_REGION: Region = {
  latitude: 35.6812,
  longitude: 139.7671,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function LocationPickerScreen(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { memoId, existingLocationId } = route.params;

  const addLocation = useMemoStore(s => s.addLocation);
  const updateLocation = useMemoStore(s => s.updateLocation);
  const defaultRadius = useSettingsStore(s => s.defaultRadius);
  const maxRadius = useSettingsStore(s => s.maxRadius);
  const recentPlaces = useSettingsStore(s => s.recentPlaces);
  const addRecentPlace = useSettingsStore(s => s.addRecentPlace);

  // 同一メモの登録済み場所（編集中の場所自体は除外）
  const otherLocations = useMemoStore(
    useShallow(s =>
      (s.memos.find(m => m.id === memoId)?.locations ?? []).filter(
        loc => loc.id !== existingLocationId,
      ),
    ),
  );

  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [label, setLabel] = useState('');
  const [radius, setRadius] = useState(defaultRadius);
  const [address, setAddress] = useState<string | null>(null);
  const [initialRegion, setInitialRegion] = useState<Region>(FALLBACK_REGION);
  // 逆ジオコーディング中フラグ（true の間は保存ボタンを非活性）
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Mapbox 場所検索
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<{ name: string; address: string; lat: number; lng: number }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mapRef = useRef<MapView>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 最大待機タイマー（5秒後に強制解除）
  const geocodingSafetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapReadyRef = useRef(false);
  const pendingRegionRef = useRef<Region | null>(null);

  const animateWhenReady = (region: Region) => {
    if (mapReadyRef.current) {
      mapRef.current?.animateToRegion(region, 500);
    } else {
      pendingRegionRef.current = region;
    }
  };

  const handleMapReady = () => {
    mapReadyRef.current = true;
    if (pendingRegionRef.current) {
      mapRef.current?.animateToRegion(pendingRegionRef.current, 500);
      pendingRegionRef.current = null;
    }
  };

  // 逆ジオコーディングで住所（町名まで）を取得 - OpenStreetMap Nominatim使用（APIキー不要）
  // Nominatim のポリシーにより 1秒以下の間隔でリクエストしないようデバウンスする
  const reverseGeocode = (lat: number, lng: number) => {
    setAddress(null);
    setIsGeocoding(true);
    // 安全タイマー: 5秒後に強制解除（ネットワーク障害時もブロックされない）
    if (geocodingSafetyRef.current) clearTimeout(geocodingSafetyRef.current);
    geocodingSafetyRef.current = setTimeout(() => setIsGeocoding(false), 5000);
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ja&zoom=16`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'YorimichiApp/1.0' },
        });
      const json = await res.json();
        if (json && json.address) {
          const a = json.address as Record<string, string>;
          // 都道府県: state（東京都等） または province（大阪府等）
          const pref  = a.state ?? a.province ?? '';
          // 市区 / 町 / 村
          const city  = a.city ?? a.town ?? a.village ?? '';
          // 区・郡など
          const ward  = a.suburb ?? '';
          // 丁目・町名
          const area  = a.quarter ?? a.neighbourhood ?? '';
          const parts  = [pref, city, ward, area].filter(Boolean);
          // 重複除去
          const unique = parts.filter((v, i) => parts.indexOf(v) === i);
          const formatted = unique.join('');
          if (formatted) {
            setAddress(formatted);
          }
        }
      } catch {
        // 住所取得失敗は無視
      } finally {
        setIsGeocoding(false);
        if (geocodingSafetyRef.current) {
          clearTimeout(geocodingSafetyRef.current);
          geocodingSafetyRef.current = null;
        }
      }
    }, 1000);
  };

  // 起動時に現在地を取得して地図の中心にセット
  useEffect(() => {
    Geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        const region: Region = {
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setInitialRegion(region);
        animateWhenReady(region);
      },
      _error => {
        // 位置情報が取得できない場合はフォールバック（東京）を使用
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 既存場所の編集時はフォームに初期値をセット
  useEffect(() => {
    if (!existingLocationId) return;
    const memo = useMemoStore.getState().memos.find(m => m.id === memoId);
    const existing = memo?.locations.find(l => l.id === existingLocationId);
    if (!existing) return;
    setLabel(existing.label);
    setRadius(existing.radius);
    if (existing.address) setAddress(existing.address);
    const coords = { latitude: existing.latitude, longitude: existing.longitude };
    setPicked(coords);
    const region: Region = { ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    setInitialRegion(region);
    setTimeout(() => animateWhenReady(region), 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMapPress = (e: LongPressEvent) => {
    const coord = e.nativeEvent.coordinate;
    setPicked(coord);
    Keyboard.dismiss();
    reverseGeocode(coord.latitude, coord.longitude);
  };

  const handleGpsPress = () => {
    Keyboard.dismiss();
    Geolocation.getCurrentPosition(
      pos => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setPicked(coords);
        reverseGeocode(coords.latitude, coords.longitude);
        setTimeout(() => {
          mapRef.current?.animateToRegion(
            { ...coords, latitudeDelta: 0.005, longitudeDelta: 0.005 },
            400,
          );
        }, 100);
      },
      _err => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  // Mapbox Geocoding API で場所を検索（300ms デバウンス）
  const handleSearchChange = (text: string) => {
    setSearchText(text);
    setSearchResults([]);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!text.trim()) return;
    searchTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const lang = i18n.language === 'ja' ? 'ja' : 'en';
        // Nominatim (OSM) を使用：APIキー不要・日本POIデータあり
        // viewbox で現在地周辺を優先、countrycodes=jp で日本に絞る
        const { latitude: clat, longitude: clng } = initialRegion;
        const delta = 1.0; // ±1度（約100km）のビューボックスで近くを優先
        const viewbox = `${clng - delta},${clat - delta},${clng + delta},${clat + delta}`;
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&accept-language=${lang}&limit=6&countrycodes=jp&viewbox=${viewbox}&bounded=0`;
        const res = await fetch(url, { headers: { 'User-Agent': 'YorimichiApp/1.0' } });
        const json = await res.json();
        const features: { display_name?: string; lat: string; lon: string; name?: string }[] = Array.isArray(json) ? json : [];
        const results = features.map(f => ({
          name: f.name ?? f.display_name?.split(',')[0] ?? text,
          address: f.display_name ?? '',
          lat: parseFloat(f.lat),
          lng: parseFloat(f.lon),
        }));
        setSearchResults(results);
      } catch {
        // 検索失敗は無視
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSearchResultPress = (name: string, lat: number, lng: number) => {
    const coords = { latitude: lat, longitude: lng };
    setPicked(coords);
    if (!label) setLabel(name);
    setSearchText('');
    setSearchResults([]);
    Keyboard.dismiss();
    reverseGeocode(lat, lng);
    addRecentPlace({ label: name, latitude: lat, longitude: lng });
    setTimeout(() => {
      mapRef.current?.animateToRegion(
        { ...coords, latitudeDelta: 0.005, longitudeDelta: 0.005 },
        400,
      );
    }, 100);
  };

  const handleRecentPlacePress = (place: RecentPlace) => {
    const coords = { latitude: place.latitude, longitude: place.longitude };
    setPicked(coords);
    setLabel(place.label);                        // 常に上書き（何度でも選択し直せる）
    setAddress(place.address ?? place.label);     // address がなければ地名をそのまま流用
    mapRef.current?.animateToRegion(
      { ...coords, latitudeDelta: 0.005, longitudeDelta: 0.005 },
      400,
    );
  };

  const handleSave = () => {
    if (!picked) {
      Alert.alert(t('locationPicker.alertNoLocation'), t('locationPicker.alertNoLocationMsg'));
      return;
    }
    if (!label.trim()) {
      Alert.alert(t('locationPicker.alertNoLabel'), t('locationPicker.alertNoLabelMsg'));
      return;
    }

    const locationData = {
      label: label.trim(),
      latitude: picked.latitude,
      longitude: picked.longitude,
      radius,
      ...(address ? { address } : {}),
    };

    if (existingLocationId) {
      updateLocation(memoId, existingLocationId, locationData);
    } else {
      const result = addLocation(memoId, locationData);
      if (!result) {
        Alert.alert(t('locationPicker.alertMaxTitle'), t('locationPicker.alertMaxMsg'));
        return;
      }
    }

    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      {/* 地図 + 上部に検索バーをオーバーレイ */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={initialRegion}
          onMapReady={handleMapReady}
          onLongPress={handleMapPress}
          showsUserLocation={true}
          showsMyLocationButton={true}>
          {picked && (
            <>
              <Marker coordinate={picked} pinColor="#4CAF50" title={t('locationPicker.markerSelected')} />
              <Circle
                center={picked}
                radius={radius}
                fillColor="rgba(76, 175, 80, 0.15)"
                strokeColor="rgba(76, 175, 80, 0.6)"
                strokeWidth={2}
              />
            </>
          )}
          {/* 登録済みの場所（青で表示） */}
          {otherLocations.map(loc => (
            <React.Fragment key={loc.id}>
              <Marker
                coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
                pinColor="#2196F3"
                title={loc.label}
                description={t('locationPicker.markerRegistered')}
              />
              <Circle
                center={{ latitude: loc.latitude, longitude: loc.longitude }}
                radius={loc.radius}
                fillColor="rgba(33, 150, 243, 0.12)"
                strokeColor="rgba(33, 150, 243, 0.5)"
                strokeWidth={2}
              />
            </React.Fragment>
          ))}
        </MapView>

        {/* 地名検索バー (Mapbox) */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputRow}>
            <Icon name="search" size={18} color="#9E9E9E" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('locationPicker.searchPlaceholder')}
              placeholderTextColor="#9E9E9E"
              value={searchText}
              onChangeText={handleSearchChange}
              returnKeyType="search"
              autoCorrect={false}
            />
            {isSearching && <ActivityIndicator size="small" color="#4CAF50" style={{ marginRight: 8 }} />}
            {searchText.length > 0 && !isSearching && (
              <TouchableOpacity onPress={() => { setSearchText(''); setSearchResults([]); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="close" size={18} color="#9E9E9E" style={{ marginRight: 8 }} />
              </TouchableOpacity>
            )}
          </View>
          {searchResults.length > 0 && (
            <FlatList
              style={styles.searchList}
              keyboardShouldPersistTaps="handled"
              data={searchResults}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchRow}
                  onPress={() => handleSearchResultPress(item.name, item.lat, item.lng)}>
                  <Icon name="place" size={16} color="#757575" style={{ marginRight: 8, marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchRowName} numberOfLines={1}>{item.name}</Text>
                    {item.address ? <Text style={styles.searchRowAddress} numberOfLines={1}>{item.address}</Text> : null}
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        {/* 現在地ボタン（検索バー右端） */}
        <TouchableOpacity style={styles.gpsBtn} onPress={handleGpsPress}>
          <Icon name="my-location" size={20} color="#4CAF50" />
        </TouchableOpacity>

        {/* ヒントバッジ */}
        <View style={styles.hintBadge}>
          <Icon name="touch-app" size={14} color="#757575" />
          <Text style={styles.hintText}>{t('locationPicker.hintLongPress')}</Text>
        </View>

        {/* 凡例（登録済み場所が1件以上ある場合のみ表示） */}
        {otherLocations.length > 0 && (
          <View style={styles.legendBadge}>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={styles.legendText}>{t('locationPicker.legendSelected')}</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
              <Text style={styles.legendText}>{t('locationPicker.legendRegistered')}</Text>
            </View>
          </View>
        )}
      </View>

      {/* フォーム: 場所名・半径・保存ボタン */}
      <View style={[styles.form, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {/* 場所名 */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t('locationPicker.labelInput')}</Text>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder={t('locationPicker.labelPlaceholder')}
            placeholderTextColor="#BDBDBD"
          />
        </View>

        {/* 半径スライダー */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t('locationPicker.radiusLabel', { radius })}</Text>
          <Slider
            style={styles.slider}
            minimumValue={50}
            maximumValue={maxRadius}
            step={10}
            value={radius}
            onValueChange={val => setRadius(val)}
            minimumTrackTintColor="#4CAF50"
            maximumTrackTintColor="#E0E0E0"
            thumbTintColor="#4CAF50"
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>50m</Text>
            <Text style={styles.sliderLabel}>{maxRadius}m</Text>
          </View>
        </View>

        {/* 選択済みバッジ */}
        {picked && (
          <View style={styles.pickedBadge}>
            {isGeocoding ? (
              <ActivityIndicator size="small" color="#4CAF50" />
            ) : (
              <Icon name="check-circle" size={14} color="#4CAF50" />
            )}
            <Text style={styles.pickedBadgeText}>
              {isGeocoding
                ? t('locationPicker.geocodingInProgress')
                : (address ?? `${picked.latitude.toFixed(5)}, ${picked.longitude.toFixed(5)}`)}
            </Text>
          </View>
        )}

        {/* 最近の場所 */}
        {recentPlaces.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.recentTitle}>{t('locationPicker.recentTitle')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {recentPlaces.map((place, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.recentChip}
                  onPress={() => handleRecentPlacePress(place)}>
                  <Icon name="history" size={14} color="#757575" />
                  <Text style={styles.recentChipText}>{place.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, isGeocoding && !!picked && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isGeocoding && !!picked}>
          {isGeocoding && !!picked
            ? <ActivityIndicator size="small" color="#fff" />
            : <Icon name="check" size={20} color="#fff" />}
          <Text style={styles.saveBtnText}>{t('locationPicker.saveButton')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },

  /* 地名検索 (Mapbox) */
  searchContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 58,
    zIndex: 10,
    elevation: 5,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    height: 44,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  searchIcon: { marginLeft: 10, marginRight: 4 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#212121',
    paddingVertical: 0,
  },
  searchList: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 4,
    elevation: 5,
    maxHeight: 220,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchRowName: { fontSize: 13, color: '#212121', fontWeight: '600' },
  searchRowAddress: { fontSize: 11, color: '#9E9E9E', marginTop: 1 },

  /* 地図 */
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },

  /* 現在地ボタン */
  gpsBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 44,
    height: 44,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    zIndex: 11,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },

  /* ヒントバッジ */
  hintBadge: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    elevation: 3,
  },
  hintText: { fontSize: 12, color: '#757575' },

  /* 凡例 */
  legendBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    elevation: 3,
    gap: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: { fontSize: 11, color: '#424242' },

  /* フォーム */
  form: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  inputGroup: { marginBottom: 10 },
  inputLabel: { fontSize: 12, color: '#757575', marginBottom: 4, fontWeight: '600' },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: '#212121',
  },

  /* スライダー */
  slider: { width: '100%', height: 40 },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  sliderLabel: { fontSize: 11, color: '#9E9E9E' },

  /* 選択済みバッジ */
  pickedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  pickedBadgeText: { fontSize: 12, color: '#2E7D32' },

  /* 最近の場所 */
  recentSection: { marginBottom: 10 },
  recentTitle: { fontSize: 12, color: '#757575', fontWeight: '600', marginBottom: 6 },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  recentChipText: { fontSize: 13, color: '#424242' },

  /* 保存ボタン */
  saveBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  saveBtnDisabled: { backgroundColor: '#A5D6A7', opacity: 0.7 },
});
