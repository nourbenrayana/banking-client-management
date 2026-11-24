<<<<<<< HEAD
// src/screens/Dashboard.tsx
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useUser } from "../../context/UserContext";
import { useEffect, useState } from "react";
import AnimatedCard from "../../components/AnimatedCard";
import config from "@/utils/config";
import ChatbotScreen from "../chatbot";
import { useTranslation } from "react-i18next";

interface Transaction { id: string; image: any; name: string; date: string; amount: number; }
interface ActionProps { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; color?: string; onPress?: () => void; }
interface TransactionItemProps { image: any; name: string; date: string; amount: string; positive?: boolean; }

export default function Dashboard() {
  const { t } = useTranslation('dashboard');
  const router = useRouter();
  const { userData, accountData } = useUser();
  const { fullName } = userData || {};
  const { cardNumber, expiryDate, cardType, status, accountId } = accountData || {};

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatVisible, setChatVisible] = useState(false);

  useEffect(() => {
    const fetchUnreadNotifications = async () => {
      if (!userData?.userId) return;
      try {
        const rawUserId = userData.userId.replace(/^users\//, "");
        const res = await fetch(`${config.BASE_URL}/api/transactions/notifications/unread/count/${rawUserId}`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setUnreadCount(data.count || 0);
      } catch {
        setUnreadCount(0);
      }
    };
    fetchUnreadNotifications();
  }, [userData?.userId]);

  useEffect(() => {
    const userNameCache = new Map<string, string>();
    const fetchUserName = async (compteId: string) => {
      if (userNameCache.has(compteId)) return userNameCache.get(compteId)!;
      try {
        const cleanedId = compteId.replace(/^comptes\//, "");
        const resCompte = await fetch(`${config.BASE_URL}/api/comptes/${cleanedId}`);
        if (!resCompte.ok) return "Unknown";
        const compteData = await resCompte.json();
        const userId = (compteData.userId || compteData.ownerId || "").replace(/^users\//, "");
        const resUser = await fetch(`${config.BASE_URL}/api/users/${userId}`);
        if (!resUser.ok) return "Unknown";
        const user = await resUser.json();
        const name = user.fullName || user.nom || "Unknown";
        userNameCache.set(compteId, name);
        return name;
      } catch {
        return "Unknown";
      }
    };

    const fetchTransactions = async () => {
      if (!accountId) return;
      try {
        const cleaned = accountId.replace(/^comptes\//, "");
        const res = await fetch(`${config.BASE_URL}/api/transactions/compte/${cleaned}`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const formatted = await Promise.all(
          data.map(async (tx: any) => {
            const isIncoming = tx.compteDestinataire?.includes(cleaned);
            const other = isIncoming ? tx.compteExpediteur : tx.compteDestinataire;
            const name = await fetchUserName(other);
            return { id: tx._id, image: require("../../assets/images/avatar1.jpg"), name, date: tx.date, amount: isIncoming ? tx.montant : -tx.montant };
          })
        );
        setTransactions(formatted);
      } catch { }
    };
    fetchTransactions();
  }, [accountId]);

  const recent = transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 2);
  const handleTransfer = () => router.push("/Payment");
  const handlePaymentChoice = () => router.push("/choixdepaiment");
  const handleRequest = () => router.push("/contact");

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greeting}>{t('dashboard.greeting', { name: fullName || t('dashboard.greeting', { name: "User" }).split(',')[0] })}</Text>
            <Text style={styles.subtitle}>{t('dashboard.welcome')}</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton} onPress={() => router.push("/NotificationScreen")}>
            <Ionicons name="notifications-outline" size={24} color="#333" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <AnimatedCard
          holderName={fullName || t('dashboard.greeting', { name: "Card Holder" }).split(',')[0]}
          cardNumber={cardNumber || "XXXX XXXX XXXX XXXX"}
          expiryDate={expiryDate || "MM/YY"}
          cardType={cardType || "VISA"}
          status={status || "inactive"}
          onTransfer={handleTransfer}
        />

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>{t('dashboard.quickActions')}</Text>
          <View style={styles.actionsContainer}>
            <Action icon="arrow-up-outline" label={t('dashboard.send')} color="#6C5CE7" onPress={handleTransfer} />
            <Action icon="wallet-outline" label={t('dashboard.pay')} color="#FD79A8" onPress={handlePaymentChoice} />
            <Action icon="help-circle-outline" label={t('dashboard.request')} color="#E17055" onPress={handleRequest} />
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('dashboard.recentTransactions')}</Text>
            <TouchableOpacity onPress={() => router.push({ pathname: "/historique", params: { compteId: accountId } })}>
              <Text style={styles.viewAll}>{t('dashboard.viewAll')}</Text>
            </TouchableOpacity>
          </View>

          {recent.length > 0 ? recent.map(tx => (
            <TransactionItem
              key={tx.id}
              image={tx.image}
              name={tx.name}
              date={new Date(tx.date).toLocaleDateString()}
              amount={`${tx.amount > 0 ? "+" : ""}€${Math.abs(tx.amount).toFixed(2)}`}
              positive={tx.amount > 0}
            />
          )) : (
            <View style={styles.noTransactions}>
              <Ionicons name="receipt-outline" size={40} color="#DFE6E9" />
              <Text style={styles.noTransactionsText}>{t('dashboard.noTransactions')}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.chatBubble} onPress={() => setChatVisible(true)}>
        <Ionicons name="chatbubbles-outline" size={24} color="white" />
      </TouchableOpacity>

      <Modal visible={chatVisible} animationType="slide" onRequestClose={() => setChatVisible(false)}>
        <View style={{ flex: 1 }}>
          <ChatbotScreen />
          <TouchableOpacity style={styles.closeButton} onPress={() => setChatVisible(false)}>
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

function Action({ icon, label, color = "#3498db", onPress }: ActionProps) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={20} color="white" />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function TransactionItem({
  image,
  name,
  date,
  amount,
  positive = true,
}: TransactionItemProps) {
  return (
    <View style={styles.transactionItem}>
      <Image source={image} style={styles.avatar} />
      <View style={styles.transactionDetails}>
        <Text style={styles.transactionName}>{name}</Text>
        <Text style={styles.transactionDate}>{date}</Text>
      </View>
      <Text style={[
        styles.transactionAmount,
        positive ? styles.income : styles.expense
      ]}>
        {amount}
      </Text>
    </View>
=======
import { Image, StyleSheet, Platform } from 'react-native';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function HomeScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Welcome!</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 1: Try it</ThemedText>
        <ThemedText>
          Edit <ThemedText type="defaultSemiBold">app/(tabs)/index.tsx</ThemedText> to see changes.
          Press{' '}
          <ThemedText type="defaultSemiBold">
            {Platform.select({
              ios: 'cmd + d',
              android: 'cmd + m',
              web: 'F12'
            })}
          </ThemedText>{' '}
          to open developer tools.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 2: Explore</ThemedText>
        <ThemedText>
          Tap the Explore tab to learn more about what's included in this starter app.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 3: Get a fresh start</ThemedText>
        <ThemedText>
          When you're ready, run{' '}
          <ThemedText type="defaultSemiBold">npm run reset-project</ThemedText> to get a fresh{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> directory. This will move the current{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> to{' '}
          <ThemedText type="defaultSemiBold">app-example</ThemedText>.
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
>>>>>>> 1dfc7ef186b686640f80cb313e05c6a934b90e90
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F8FAFD",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  headerTextContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2D3436",
  },
  subtitle: {
    fontSize: 14,
    color: "#636E72",
    marginTop: 4,
  },
  notificationButton: {
    padding: 8,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E74C3C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  sectionContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2D3436",
  },
  viewAll: {
    color: "#0984E3",
    fontSize: 14,
    fontWeight: "500",
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  actionButton: {
    alignItems: "center",
    width: 70,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#636E72",
    textAlign: "center",
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2F7",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#2D3436",
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: "#636E72",
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "600",
  },
  income: {
    color: "#00B894",
  },
  expense: {
    color: "#D63031",
  },
  noTransactions: {
    alignItems: "center",
    paddingVertical: 30,
  },
  noTransactionsText: {
    color: "#636E72",
    marginTop: 10,
  },
  chatBubble: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: "#2e86de",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    zIndex: 10,
  },
  closeButton: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: "#2e86de",
    borderRadius: 20,
    padding: 8,
    elevation: 4,
  },
});


=======
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
>>>>>>> 1dfc7ef186b686640f80cb313e05c6a934b90e90
