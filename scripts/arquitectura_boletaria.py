#!/usr/bin/env python3
"""Genera el diagrama PNG de arquitectura AWS para la plataforma de boletaría."""

from diagrams import Cluster, Diagram
from diagrams.aws.compute import AutoScaling, EC2
from diagrams.aws.database import RDS
from diagrams.aws.management import Cloudwatch
from diagrams.aws.network import ALB, CloudFront, InternetGateway
from diagrams.aws.security import ACM
from diagrams.aws.storage import S3
from diagrams.onprem.client import Users

OUTPUT = "arquitectura_boletaria"

with Diagram(
    "Arquitectura Cloud - Plataforma de Boletaría Digital",
    filename=OUTPUT,
    show=False,
    direction="LR",
    graph_attr={
        "fontsize": "18",
        "size": "28,16",
        "pad": "0.5",
    },
):
    usuarios = Users("Usuarios Web / Móvil")
    monitoring = Cloudwatch("CloudWatch\nLogs y Métricas")

    with Cluster("Frontend estático"):
        cdn = CloudFront("CloudFront\n(recomendado)")
        frontend = S3("S3\nSPA ticket-frontend")
        cdn >> frontend

    with Cluster("VPC - AWS"):
        internet = InternetGateway("Internet Gateway")
        cert = ACM("Certificado SSL/TLS\n(ALB / CloudFront)")

        with Cluster("Subred Pública"):
            alb = ALB("Application Load Balancer\nHTTPS")

        with Cluster("Subred Pública - Backend (Auto Scaling)"):
            asg = AutoScaling("Auto Scaling Group")
            api_1 = EC2("EC2\nticket-api")
            api_2 = EC2("EC2\nticket-api")
            asg >> [api_1, api_2]

        with Cluster("Capa de Datos (privada recomendada)"):
            db = RDS("RDS PostgreSQL")
            storage = S3("S3\nBanners / PDFs")

    usuarios >> cdn
    usuarios >> internet >> cert >> alb

    alb >> asg

    api_1 >> db
    api_2 >> db
    api_1 >> storage
    api_2 >> storage

    alb >> monitoring
    asg >> monitoring
    api_1 >> monitoring
    api_2 >> monitoring
    db >> monitoring

print(f"Diagrama generado: {OUTPUT}.png")
