<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Tests\Types;

use PHPUnit\Framework\TestCase;
use WebSanity\FormSanity\AuthoringError;
use WebSanity\FormSanity\Types\Validator;
use WebSanity\FormSanity\Types\Verdict;

final class ValidatorTest extends TestCase
{
	public function testAnEmptyValueIsValidForEveryType(): void
	{
		foreach (['alpha', 'email', 'ipv4', 'credit-card', 'us-phone', 'duration'] as $type) {
			self::assertSame(Verdict::Valid, Validator::check($type, ''));
		}
	}

	public function testAnUnknownTypeIsAnAuthoringError(): void
	{
		$this->expectException(AuthoringError::class);
		Validator::check('postcode', 'SW1A 1AA');
	}

	public function testKnownTypesAreTheCatalog(): void
	{
		foreach (['alpha', 'alphanum', 'identifier', 'no-whitespace', 'email', 'cvv', 'ssn', 'duration', 'us-dollar', 'zip', 'ipv4', 'ipv6', 'ip', 'email-list', 'credit-card', 'us-phone', 'international-phone'] as $type) {
			self::assertTrue(Validator::isKnown($type), $type);
		}
		self::assertFalse(Validator::isKnown('date'));
	}

	public function testOrderedTypesCompareInTheirOwnOrder(): void
	{
		self::assertTrue(Validator::isOrdered('duration'));
		self::assertTrue(Validator::isOrdered('us-dollar'));
		self::assertFalse(Validator::isOrdered('email'));
		self::assertSame(90.0, Validator::order('duration', '1:30'));
		self::assertSame(90.0, Validator::order('duration', '90'));
		self::assertSame(1234.5, Validator::order('us-dollar', '$1,234.50'));
		self::assertNull(Validator::order('duration', '1:75'));
		self::assertNull(Validator::order('email', 'a@b.co'));
	}

	public function testVerdictRanking(): void
	{
		self::assertTrue(Verdict::Invalid->worseThan(Verdict::Incomplete));
		self::assertTrue(Verdict::Incomplete->worseThan(Verdict::Valid));
		self::assertFalse(Verdict::Valid->worseThan(Verdict::Valid));
		self::assertSame(Verdict::Invalid, Verdict::worst(Verdict::Valid, Verdict::Invalid, Verdict::Incomplete));
		self::assertSame(Verdict::Valid, Verdict::worst());
	}

	public function testAValueThatIsNotUtf8IsInvalidForEveryType(): void
	{
		foreach (['ipv4', 'ipv6', 'ip', 'email-list', 'us-phone', 'international-phone', 'cvv', 'alpha', 'credit-card'] as $type) {
			self::assertSame(Verdict::Invalid, Validator::check($type, "192.168.1.\xFF"), $type);
		}
	}

	public function testDigitsAreAsciiOnly(): void
	{
		self::assertSame(Verdict::Invalid, Validator::check('cvv', '٣٤٥'));
		self::assertSame(Verdict::Invalid, Validator::check('zip', '٨٠٢١٠'));
		self::assertSame(Verdict::Invalid, Validator::check('credit-card', '34٨٣٣٩٢٣9', 'Amex'));
		self::assertSame(Verdict::Valid, Validator::check('cvv', '345'));
	}

	public function testUnicodeWhitespaceStillCountsAsWhitespace(): void
	{
		self::assertSame(Verdict::Invalid, Validator::check('no-whitespace', "a\u{00A0}b"));
		self::assertSame(Verdict::Invalid, Validator::check('email', "a\u{00A0}@b.co"));
	}

	public function testAnEmptyParamMeansTheDefaultNetworks(): void
	{
		self::assertSame(Verdict::Valid, Validator::check('credit-card', '4242424242424242', ''));
	}
}
