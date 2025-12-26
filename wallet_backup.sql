-- MySQL dump 10.13  Distrib 8.0.44, for Linux (x86_64)
--
-- Host: localhost    Database: finance_db
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `bill_payments`
--

DROP TABLE IF EXISTS `bill_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bill_payments` (
  `id` varchar(36) NOT NULL,
  `bill_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `bulan` varchar(7) NOT NULL,
  `dibayar_pada` timestamp NOT NULL,
  `jumlah_dibayar` decimal(15,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `bill_id` (`bill_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `bill_payments_ibfk_1` FOREIGN KEY (`bill_id`) REFERENCES `bills` (`id`) ON DELETE CASCADE,
  CONSTRAINT `bill_payments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bill_payments`
--

LOCK TABLES `bill_payments` WRITE;
/*!40000 ALTER TABLE `bill_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `bill_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bills`
--

DROP TABLE IF EXISTS `bills`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bills` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `nama` varchar(100) NOT NULL,
  `kategori` varchar(50) NOT NULL,
  `jumlah` decimal(15,2) NOT NULL,
  `tanggal_jatuh_tempo` int NOT NULL,
  `mulai_dari` varchar(7) NOT NULL,
  `sampai_dengan` varchar(10) NOT NULL,
  `catatan` text,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `bills_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bills`
--

LOCK TABLES `bills` WRITE;
/*!40000 ALTER TABLE `bills` DISABLE KEYS */;
/*!40000 ALTER TABLE `bills` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `budgets`
--

DROP TABLE IF EXISTS `budgets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budgets` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `bulan` varchar(7) NOT NULL,
  `kategori` varchar(50) NOT NULL,
  `anggaran` decimal(15,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `budgets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budgets`
--

LOCK TABLES `budgets` WRITE;
/*!40000 ALTER TABLE `budgets` DISABLE KEYS */;
/*!40000 ALTER TABLE `budgets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `expenses`
--

DROP TABLE IF EXISTS `expenses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenses` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `tanggal` varchar(10) NOT NULL,
  `bulan` varchar(7) NOT NULL,
  `nama` varchar(100) NOT NULL,
  `kategori` varchar(50) NOT NULL,
  `metode` varchar(50) NOT NULL,
  `jumlah` decimal(15,2) NOT NULL,
  `catatan` text,
  `bill_payment_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `expenses_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenses`
--

LOCK TABLES `expenses` WRITE;
/*!40000 ALTER TABLE `expenses` DISABLE KEYS */;
/*!40000 ALTER TABLE `expenses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `incomes`
--

DROP TABLE IF EXISTS `incomes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `incomes` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `tanggal` varchar(10) NOT NULL,
  `bulan` varchar(7) NOT NULL,
  `sumber` varchar(100) NOT NULL,
  `kategori` varchar(50) NOT NULL,
  `metode` varchar(50) NOT NULL,
  `jumlah` decimal(15,2) NOT NULL,
  `catatan` text,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `incomes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `incomes`
--

LOCK TABLES `incomes` WRITE;
/*!40000 ALTER TABLE `incomes` DISABLE KEYS */;
/*!40000 ALTER TABLE `incomes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `master_data`
--

DROP TABLE IF EXISTS `master_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `master_data` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `type` enum('kategoriPemasukan','kategoriPengeluaran','metodePembayaran') NOT NULL,
  `value` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `master_data_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `master_data`
--

LOCK TABLES `master_data` WRITE;
/*!40000 ALTER TABLE `master_data` DISABLE KEYS */;
INSERT INTO `master_data` VALUES ('2dda1ef8-5c54-4399-8b12-d91f2b43e52c','9401cd04-c92e-4cf7-acfe-b9a704b431f0','kategoriPemasukan','Bonus'),('36264d89-39c1-47e7-ab72-f1764352a412','9401cd04-c92e-4cf7-acfe-b9a704b431f0','metodePembayaran','Cash'),('3ba2f5d7-723c-439d-983f-f644184e6fe0','9401cd04-c92e-4cf7-acfe-b9a704b431f0','metodePembayaran','Debit'),('4105d66c-ef8a-48cc-9a8a-0e8e909ce717','9401cd04-c92e-4cf7-acfe-b9a704b431f0','kategoriPengeluaran','Makanan'),('46b7d85d-0431-46d0-990d-936127347d42','9401cd04-c92e-4cf7-acfe-b9a704b431f0','kategoriPengeluaran','Hiburan'),('484549a9-0d1c-4a48-871a-7a14d284acd8','9401cd04-c92e-4cf7-acfe-b9a704b431f0','kategoriPengeluaran','Kesehatan'),('49d1b7c2-b67c-495c-8e0f-b1cb6bc09710','9401cd04-c92e-4cf7-acfe-b9a704b431f0','metodePembayaran','Lainnya'),('4d88ac3b-674b-4e03-aa59-82aecf49e74b','9401cd04-c92e-4cf7-acfe-b9a704b431f0','metodePembayaran','Credit'),('5a69f464-4bcc-4ff6-a999-a8b6bd6b2c0b','9401cd04-c92e-4cf7-acfe-b9a704b431f0','kategoriPemasukan','Lainnya'),('6868ac1f-f94d-4218-9f3e-7764d0079272','9401cd04-c92e-4cf7-acfe-b9a704b431f0','kategoriPemasukan','Freelance'),('68898ab5-6e86-4c5f-a26f-d5975e91530e','9401cd04-c92e-4cf7-acfe-b9a704b431f0','kategoriPengeluaran','Belanja'),('695bf446-5231-41a3-b719-89cd41cdb4e2','9401cd04-c92e-4cf7-acfe-b9a704b431f0','kategoriPemasukan','Investasi'),('6f32bc9d-f77a-46a7-bd7c-b0dc8a8884c2','9401cd04-c92e-4cf7-acfe-b9a704b431f0','metodePembayaran','Transfer'),('7684081e-ad99-4bbf-93c9-5ffccbc01a72','9401cd04-c92e-4cf7-acfe-b9a704b431f0','kategoriPengeluaran','Pendidikan'),('8ac660eb-7671-4c88-9ce4-067876bd5177','9401cd04-c92e-4cf7-acfe-b9a704b431f0','kategoriPengeluaran','Lainnya'),('8be706da-538e-4bc2-9ee6-16d3c57364f3','9401cd04-c92e-4cf7-acfe-b9a704b431f0','kategoriPengeluaran','Transportasi'),('8cf66c96-4fc6-4ea0-ba76-50309c275ef1','9401cd04-c92e-4cf7-acfe-b9a704b431f0','kategoriPemasukan','Gaji'),('ad2f51a4-4af1-453f-8ce5-f8efc9704570','9401cd04-c92e-4cf7-acfe-b9a704b431f0','metodePembayaran','E-wallet'),('cf786e23-7469-4b24-a4d6-d7b30c43d453','9401cd04-c92e-4cf7-acfe-b9a704b431f0','kategoriPengeluaran','Tagihan'),('f9506df9-9f1f-47e1-a21e-ca371f63804f','9401cd04-c92e-4cf7-acfe-b9a704b431f0','kategoriPemasukan','Hadiah');
/*!40000 ALTER TABLE `master_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `savings`
--

DROP TABLE IF EXISTS `savings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `savings` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `tanggal` varchar(10) NOT NULL,
  `jenis` enum('Tabungan','Investasi') NOT NULL,
  `nama_akun` varchar(100) NOT NULL,
  `setoran` decimal(15,2) DEFAULT '0.00',
  `penarikan` decimal(15,2) DEFAULT '0.00',
  `catatan` text,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `savings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `savings`
--

LOCK TABLES `savings` WRITE;
/*!40000 ALTER TABLE `savings` DISABLE KEYS */;
/*!40000 ALTER TABLE `savings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(36) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('9401cd04-c92e-4cf7-acfe-b9a704b431f0','afatyo','$2a$10$AA6xyT/lAc.7Ca7evDaFz.WJoD/J1wliD.DvSjcOv0yD75w39iLC6','2025-12-25 13:22:20');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-25 13:25:49
