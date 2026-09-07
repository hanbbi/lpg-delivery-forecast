pipeline {
    agent any

    environment {
        DOCKER_HUB_REPO = 'yhb1109/lpg-nextjs'
        DOCKER_HUB_ML_REPO = 'yhb1109/lpg-ml-server'
        IMAGE_TAG = "${BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            steps {
                echo '📥 코드 체크아웃...'
                checkout scm
            }
        }

        stage('Build Docker Images') {
            steps {
                echo '🐳 Docker 이미지 빌드 중...'
                sh "docker build -t ${DOCKER_HUB_REPO}:${IMAGE_TAG} ."
                sh "docker tag ${DOCKER_HUB_REPO}:${IMAGE_TAG} ${DOCKER_HUB_REPO}:latest"

                sh "docker build -t ${DOCKER_HUB_ML_REPO}:${IMAGE_TAG} ./python"
                sh "docker tag ${DOCKER_HUB_ML_REPO}:${IMAGE_TAG} ${DOCKER_HUB_ML_REPO}:latest"
            }
        }

        stage('Push to Docker Hub') {
            steps {
                echo '📤 Docker Hub에 Push 중...'
                withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                    sh "echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin"
                    sh "docker push ${DOCKER_HUB_REPO}:${IMAGE_TAG}"
                    sh "docker push ${DOCKER_HUB_REPO}:latest"
                    sh "docker push ${DOCKER_HUB_ML_REPO}:${IMAGE_TAG}"
                    sh "docker push ${DOCKER_HUB_ML_REPO}:latest"
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                echo '☸️ Kubernetes에 배포 중...'
                sh "sed -i 's|IMAGE_PLACEHOLDER|${DOCKER_HUB_REPO}:${IMAGE_TAG}|g' k8s/deployment.yaml"
                sh "sed -i 's|ML_IMAGE_PLACEHOLDER|${DOCKER_HUB_ML_REPO}:${IMAGE_TAG}|g' k8s/ml-server.yaml"
                sh "kubectl apply -f k8s/ml-server.yaml"
                sh "kubectl apply -f k8s/deployment.yaml"
            }
        }
    }

    post {
        success {
            echo '✅ 배포 성공!'
        }
        failure {
            echo '❌ 배포 실패!'
        }
    }
}
