<<<<<<< HEAD
import { Tabs } from "expo-router";
import { Ionicons, MaterialIcons, FontAwesome } from "@expo/vector-icons";
import { useColorScheme } from "react-native";
import Colors from "../../constants/Colors";
import { useEffect } from "react";
import { useUser } from "../../context/UserContext";
import { useWebSocket } from "../../hooks/useWebSocket";
import * as Notifications from "expo-notifications";
import { useTranslation } from "react-i18next";


export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { userData } = useUser();
  const { notification } = useWebSocket();
  const { t } = useTranslation('layout');

  useEffect(() => {
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        alert(t("notifications.disabledAlert"));
      }
    };
    requestPermissions();

    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log("Notification reçue:", notification);
    });

    return () => {
      subscription.remove();
    };
  }, []);
=======
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { MaterialIcons } from '@expo/vector-icons'; // Ajout de l'importation
import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
>>>>>>> 1dfc7ef186b686640f80cb313e05c6a934b90e90

  return (
    <Tabs
      screenOptions={{
<<<<<<< HEAD
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tabBarActiveTint,
        tabBarInactiveTintColor: Colors[colorScheme ?? "light"].tabBarInactiveTint,
        tabBarStyle: {
          backgroundColor: Colors[colorScheme ?? "light"].tabBarBackground,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="exchange"
        options={{
          title: t("tabs.exchange"),
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="currency-exchange" size={size} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="card"
        options={{
          title: t("tabs.cards"),
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="credit-card-alt" size={size} color={color} />
          ),
          headerShown: false,
=======
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: 'Camera',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="camera-alt" size={size} color={color} />
          ),
>>>>>>> 1dfc7ef186b686640f80cb313e05c6a934b90e90
        }}
      />
    </Tabs>
  );
}
<<<<<<< HEAD

=======
>>>>>>> 1dfc7ef186b686640f80cb313e05c6a934b90e90
