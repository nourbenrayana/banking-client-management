from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from flask import Flask, request, jsonify,Blueprint
from langdetect import detect, LangDetectException

# Initialisation
app = Blueprint('chatbot', __name__)
# Charger le modèle (multilingue)
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

# FAQ enrichie (français et anglais)
faq = [
    {
        "questions": [
            "Comment effectuer un paiement via l'application ?",
            "Comment faire un paiement dans l'application ?",
            "Je veux payer une facture, comment faire ?",
            "Comment procéder à un paiement mobile ?",
            "Où faire un paiement dans l'app ?",
            "How to make a payment via the app?",
            "How do I pay in the application?",
            "I want to pay a bill, how to do it?",
            "How to proceed with mobile payment?",
            "Where to make a payment in the app?",
            "Como fazer um pagamento via aplicativo?",
            "Como realizar um pagamento no aplicativo?",
            "Quero pagar uma conta, como fazer?",
            "Como proceder com pagamento móvel?",
            "Onde fazer um pagamento no app?"
        ],
        "answer": {
            "fr": "1. Accédez à la fonctionnalité Paiement\n2. Sélectionnez le destinataire ou la facture\n3. Saisissez le montant et validez\n4. Entrez le code OTP reçu",
            "en": "1. Go to the Payment feature\n2. Select the recipient or bill\n3. Enter the amount and validate\n4. Enter the received OTP code",
            "pt": "1. Acesse a funcionalidade Pagamento\n2. Selecione o destinatário ou a conta\n3. Insira o valor e valide\n4. Digite o código OTP recebido"
        }
    },
    {
        "questions": [
            "Que faire si le code OTP est incorrect ?",
            "Le code OTP ne marche pas, que faire ?",
            "J'ai un message 'code OTP incorrect', pourquoi ?",
            "Pourquoi mon code OTP est refusé ?",
            "Mon OTP est invalide, que dois-je faire ?",
            "What to do if the OTP code is incorrect?",
            "The OTP code doesn't work, what to do?",
            "I get 'incorrect OTP code' message, why?",
            "Why is my OTP code rejected?",
            "My OTP is invalid, what should I do?",
            "O que fazer se o código OTP estiver incorreto?",
            "O código OTP não funciona, o que fazer?",
            "Recebo mensagem 'código OTP incorreto', por quê?",
            "Por que meu código OTP foi recusado?",
            "Meu OTP é inválido, o que devo fazer?"
        ],
        "answer": {
            "fr": "Le système affichera 'Code OTP incorrect' et annulera l'opération. Vous devrez recommencer.",
            "en": "The system will display 'Incorrect OTP code' and cancel the operation. You'll need to start over.",
            "pt": "O sistema exibirá 'Código OTP incorreto' e cancelará a operação. Você precisará começar novamente."
        }
    },
    {
        "questions": [
            "Comment se connecter avec la reconnaissance faciale ?",
            "Connexion via reconnaissance faciale, comment ça marche ?",
            "Utiliser mon visage pour me connecter, comment faire ?",
            "Je veux me connecter avec la caméra, comment faire ?",
            "Connexion biométrique, comment ça fonctionne ?",
            "How to login with facial recognition?",
            "Login via face recognition, how does it work?",
            "Use my face to log in, how to do it?",
            "I want to login with the camera, how to do it?",
            "Biometric login, how does it work?",
            "Como fazer login com reconhecimento facial?",
            "Login por reconhecimento facial, como funciona?",
            "Usar meu rosto para entrar, como fazer?",
            "Quero fazer login com a câmera, como fazer?",
            "Login biométrico, como funciona?"
        ],
        "answer": {
            "fr": "1. Ouvrez l'application et choisissez 'Connexion par reconnaissance faciale'\n2. Scannez votre visage\n3. Si la correspondance est validée, vous accéderez à votre tableau de bord",
            "en": "1. Open the app and choose 'Facial recognition login'\n2. Scan your face\n3. If the match is validated, you'll access your dashboard",
            "pt": "1. Abra o aplicativo e escolha 'Login por reconhecimento facial'\n2. Escaneie seu rosto\n3. Se a correspondência for validada, você acessará seu painel"
        }
    },
    {
        "questions": [
            "Que faire si mon visage n'est pas reconnu ?",
            "L'application ne reconnaît pas mon visage, que faire ?",
            "Pourquoi la reconnaissance faciale échoue ?",
            "Mon visage n'est pas détecté, que dois-je faire ?",
            "Problème avec la reconnaissance faciale, solutions ?",
            "What to do if my face isn't recognized?",
            "The app doesn't recognize my face, what to do?",
            "Why does facial recognition fail?",
            "My face isn't detected, what should I do?",
            "Problem with facial recognition, any solutions?",
            "O que fazer se meu rosto não for reconhecido?",
            "O aplicativo não reconhece meu rosto, o que fazer?",
            "Por que o reconhecimento facial falha?",
            "Meu rosto não é detectado, o que devo fazer?",
            "Problema com reconhecimento facial, soluções?"
        ],
        "answer": {
            "fr": "Le système affichera 'Visage non reconnu, veuillez réessayer ou utiliser une autre méthode'",
            "en": "The system will display 'Face not recognized, please try again or use another method'",
            "pt": "O sistema exibirá 'Rosto não reconhecido, por favor tente novamente ou use outro método'"
        }
    },
    {
        "questions": [
            "Comment consulter l'historique de mes transactions ?",
            "Où voir mes transactions passées ?",
            "Comment accéder à l'historique de mes paiements ?",
            "Je veux voir mes virements, comment faire ?",
            "Voir les anciennes opérations, comment faire ?",
            "How to check my transaction history?",
            "Where to see my past transactions?",
            "How to access my payment history?",
            "I want to see my transfers, how to do it?",
            "View old operations, how to do it?",
            "Como consultar meu histórico de transações?",
            "Onde vejo minhas transações anteriores?",
            "Como acessar meu histórico de pagamentos?",
            "Quero ver minhas transferências, como fazer?",
            "Ver operações antigas, como fazer?"
        ],
        "answer": {
            "fr": "1. Accédez à la section 'Historique'\n2. Sélectionnez le type d'opération (virements, retraits, achats)\n3. Le système affichera la liste des transactions",
            "en": "1. Go to the 'History' section\n2. Select the operation type (transfers, withdrawals, purchases)\n3. The system will display the transaction list",
            "pt": "1. Acesse a seção 'Histórico'\n2. Selecione o tipo de operação (transferências, saques, compras)\n3. O sistema exibirá a lista de transações"
        }
    },
    {
        "questions": [
            "Au revoir",
            "Bye",
            "Merci, au revoir",
            "À la prochaine",
            "Je m'en vais",
            "On se reparle plus tard",
            "Ciao",
            "Bonne journée",
            "À bientôt",
            "Goodbye",
            "Bye",
            "Thanks, goodbye",
            "See you later",
            "I'm leaving",
            "Talk to you later",
            "Ciao",
            "Have a good day",
            "See you soon",
            "Adeus",
            "Tchau",
            "Obrigado, até logo",
            "Até a próxima",
            "Estou indo",
            "Falamos depois",
            "Bom dia",
            "Até breve"
        ],
        "answer": {
            "fr": "Au revoir ! N'hésitez pas à revenir si vous avez d'autres questions. 😊",
            "en": "Goodbye! Feel free to come back if you have more questions. 😊",
            "pt": "Adeus! Sinta-se à vontade para voltar se tiver mais perguntas. 😊"
        }
    },
    {
        "questions": [
            "Bonjour",
            "Salut",
            "Bonsoir",
            "Hello",
            "Coucou",
            "Bonjour chatbot",
            "Salut bot",
            "Hey",
            "Hi",
            "Good morning",
            "Good evening",
            "Hello chatbot",
            "Olá",
            "Oi",
            "Boa tarde",
            "Bom dia",
            "Oi chatbot",
            "Olá robô"
        ],
        "answer": {
            "fr": "Bonjour ! Comment puis-je vous aider aujourd'hui ? 😊",
            "en": "Hello! How can I help you today? 😊",
            "pt": "Olá! Como posso ajudá-lo hoje? 😊"
        }
    },
    {
        "questions": [
            "Comment bloquer ma carte ?",
            "Ma carte est perdue",
            "Que faire si ma carte est volée ?",
            "Bloquer ma carte bancaire",
            "Opposition carte",
            "How to block my card?",
            "My card is lost",
            "What to do if my card is stolen?",
            "Block my bank card",
            "Card cancellation",
            "Como bloquear meu cartão?",
            "Meu cartão está perdido",
            "O que fazer se meu cartão for roubado?",
            "Bloquear meu cartão bancário",
            "Cancelar cartão"
        ],
        "answer": {
            "fr": "Accédez à la section 'Mes Cartes' puis sélectionnez 'Bloquer la carte'. Vous pouvez aussi contacter le service client.",
            "en": "Go to the 'My Cards' section then select 'Block card'. You can also contact customer service.",
            "pt": "Acesse a seção 'Meus Cartões' e selecione 'Bloquear cartão'. Você também pode entrar em contato com o atendimento ao cliente."
        }
    },
    {
        "questions": [
            "Comment mettre à jour l'application ?",
            "L'application est lente",
            "Pourquoi l'app bug ?",
            "Mettre à jour l'app mobile",
            "L'application se ferme toute seule",
            "How to update the application?",
            "The app is slow",
            "Why is the app buggy?",
            "Update the mobile app",
            "The app keeps closing by itself",
            "Como atualizar o aplicativo?",
            "O aplicativo está lento",
            "Por que o app está com bugs?",
            "Atualizar o aplicativo móvel",
            "O aplicativo fecha sozinho"
        ],
        "answer": {
            "fr": "Assurez-vous d'avoir la dernière version via le Play Store ou App Store. Redémarrez votre téléphone si le problème persiste.",
            "en": "Make sure you have the latest version via the Play Store or App Store. Restart your phone if the problem persists.",
            "pt": "Certifique-se de ter a versão mais recente pela Play Store ou App Store. Reinicie seu telefone se o problema persistir."
        }
    }
]

# Préparer les données
all_questions = []
answers_fr = []
answers_en = []
answers_pt = []

for entry in faq:
    all_questions.extend(entry["questions"])
    answers_fr.extend([entry["answer"]["fr"]] * len(entry["questions"]))
    answers_en.extend([entry["answer"]["en"]] * len(entry["questions"]))
    answers_pt.extend([entry["answer"]["pt"]] * len(entry["questions"]))

# Créer les embeddings
question_embeddings = model.encode(all_questions)

# Détection de langue améliorée avec langdetect
def detect_language(text):
    try:
        lang = detect(text)
        if lang in ['fr', 'en', 'pt']:
            return lang
        return 'en'  # fallback to English
    except LangDetectException:
        return 'en'  # fallback to English

# Route API avec toutes les vérifications
@app.route('/ask', methods=['POST'])
def answer():
    # Vérification du content-type
    if not request.is_json:
        return jsonify({
            'error': 'Unsupported Media Type',
            'message': 'Content-Type must be application/json'
        }), 415
    
    # Récupération des données JSON
    try:
        data = request.get_json()
    except Exception as e:
        return jsonify({
            'error': 'Bad Request',
            'message': 'Invalid JSON format'
        }), 400
    
    # Vérification de la présence de la question
    if not data or 'question' not in data:
        return jsonify({
            'error': 'Bad Request',
            'message': 'Question is required in the request body'
        }), 400
    
    question = data['question'].strip()
    
    # Vérification que la question n'est pas vide
    if not question:
        return jsonify({
            'error': 'Bad Request',
            'message': 'Question cannot be empty'
        }), 400
    
    # Traitement de la question
    try:
        question_embedding = model.encode([question])
        similarities = cosine_similarity(question_embedding, question_embeddings)[0]
        best_index = int(np.argmax(similarities))
        similarity_score = float(similarities[best_index])
        
        # Détection de la langue
        detected_lang = detect_language(question)
        
        # Sélection de la réponse dans la bonne langue
        if detected_lang == 'fr':
            answer = answers_fr[best_index]
        elif detected_lang == 'pt':
            answer = answers_pt[best_index]
        else:  # default to English
            answer = answers_en[best_index]
        
        # Réponse réussie
        return jsonify({
            'question': question,
            'detected_language': detected_lang,
            'answer': answer,
            'similarity_score': similarity_score,
            'status': 'success'
        })
    
    except Exception as e:
        # Gestion des erreurs de traitement
        app.logger.error(f"Error processing question: {str(e)}")
        return jsonify({
            'error': 'Internal Server Error',
            'message': 'An error occurred while processing your question'
        }), 500

# Gestion des erreurs 404
@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': 'Not Found',
        'message': 'The requested endpoint was not found'
    }), 404

# Gestion des erreurs 405
@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({
        'error': 'Method Not Allowed',
        'message': 'This method is not allowed for the requested endpoint'
    }), 405

# Gestion des erreurs 500
@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'error': 'Internal Server Error',
        'message': 'An internal server error occurred'
    }), 500

# Lancement du serveur Flask
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)