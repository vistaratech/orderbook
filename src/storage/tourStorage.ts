import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_TOUR_COMPLETED_KEY = '@kadaibook_app_tour_completed';

/**
 * Checks whether the user has completed or dismissed the interactive app tour.
 */
export async function hasCompletedTour(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(APP_TOUR_COMPLETED_KEY);
    return val === 'true';
  } catch (error) {
    console.warn('Error reading tour status:', error);
    return false;
  }
}

/**
 * Sets whether the interactive app tour is marked as completed.
 */
export async function setTourCompleted(completed: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(APP_TOUR_COMPLETED_KEY, completed ? 'true' : 'false');
  } catch (error) {
    console.warn('Error writing tour status:', error);
  }
}

/**
 * Resets the tour status so the user can retake the interactive tour.
 */
export async function resetTour(): Promise<void> {
  try {
    await AsyncStorage.removeItem(APP_TOUR_COMPLETED_KEY);
  } catch (error) {
    console.warn('Error resetting tour status:', error);
  }
}
